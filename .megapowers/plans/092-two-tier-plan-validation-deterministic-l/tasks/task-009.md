---
id: 9
title: Make handlePlanDraftDone async with T1 lint integration
status: approved
depends_on:
  - 6
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Covers:** AC10, AC14, AC15, AC20

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/tool-signal.test.ts — add to existing file
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";

describe("handlePlanDraftDone — async T1 lint integration", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-plan-draft-done-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeTask(tmpDir: string, id: number, title = `Task ${id}`) {
    const tasksDir = join(tmpDir, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, `task-${String(id).padStart(3, "0")}.md`),
      `---\nid: ${id}\ntitle: ${title}\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/foo.ts]\nfiles_to_create: []\n---\n${"A".repeat(220)}`,
    );
  }

  it("blocks transition when model lint returns fail findings", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );
    const failFn = async () => JSON.stringify({
      verdict: "fail",
      findings: ["AC1 is not covered by any task"],
    });
    const result = await handlePlanDraftDone(tmp, failFn);
    expect(result.error).toContain("T1 plan lint failed");
    expect(result.error).toContain("AC1 is not covered by any task");
    expect(readState(tmp).planMode).toBe("draft");
  });

  it("uses derived acceptance criteria for bugfix workflow (diagnosis/fixed-when)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "bugfix" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "diagnosis.md"),
      "## Fixed When\n1. Crash no longer occurs when input is empty",
    );

    let seenPrompt = "";
    const captureFn = async (prompt: string) => {
      seenPrompt = prompt;
      return JSON.stringify({ verdict: "pass", findings: [] });
    };

    const result = await handlePlanDraftDone(tmp, captureFn);
    expect(result.error).toBeUndefined();
    expect(seenPrompt).toContain("Crash no longer occurs when input is empty");
  });

  it("transitions planMode to review and sets triggerNewSession on pass", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeTask(tmp, 1);

    writeFileSync(
      join(tmp, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );

    const passFn = async () => JSON.stringify({ verdict: "pass", findings: [] });

    const result = await handlePlanDraftDone(tmp, passFn);
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(readState(tmp).planMode).toBe("review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `handlePlanDraftDone` is not exported from `tool-signal.ts` (it exists as a private function), so the import statement will produce a module resolution error: `SyntaxError: The requested module '../extensions/megapowers/tools/tool-signal.js' does not provide an export named 'handlePlanDraftDone'`.

**Step 3 — Write minimal implementation**

Update `extensions/megapowers/tools/tool-signal.ts`:

**1. Add new imports** at the top of the file (after existing imports):

```typescript
import { deriveAcceptanceCriteria } from "../state/derived.js";
import { lintPlanWithModel, type CompleteFn } from "../validation/plan-lint-model.js";
```

Note: `listPlanTasks` is already imported on line 4.

**2. Remove `plan_draft_done` case from `handleSignal`'s switch** — remove these lines:

```typescript
    case "plan_draft_done":
      return handlePlanDraftDone(cwd);
```

Keep `"plan_draft_done"` in the action type union so TypeScript still accepts it as input (the default case will return the appropriate error for any direct callers).

**3. Export standalone async function** (replace the existing private `handlePlanDraftDone` function):

```typescript
export async function handlePlanDraftDone(cwd: string, completeFn?: CompleteFn): Promise<SignalResult> {
  const state = readState(cwd);
  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }
  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }
  let lintWarning = "";
  if (completeFn) {
    const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
    const criteriaText = criteria.map((c) => `${c.id}. ${c.text}`).join("\n");
    const taskSummaries = tasks.map((t) => ({
      id: t.data.id,
      title: t.data.title,
      description: t.content,
      files: [...t.data.files_to_modify, ...t.data.files_to_create],
    }));
    const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
    if (!lintResult.pass) {
      return { error: `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}` };
    }
    if (lintResult.warning) {
      lintWarning = `\n  ⚠️ ${lintResult.warning}`;
    }
  }
  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      `  → Transitioning to review mode.${lintWarning}`,
    triggerNewSession: true,
  };
}
```

**4. Migrate existing `plan_draft_done` tests in `tests/tool-signal.test.ts`**

There are 8 calls to `handleSignal(tmp, "plan_draft_done")` across two locations. All must be migrated.

First, update the import line to add `handlePlanDraftDone`:

```typescript
// BEFORE:
import { handleSignal } from "../extensions/megapowers/tools/tool-signal.js";

// AFTER:
import { handleSignal, handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";
```

Then migrate the `describe("plan_draft_done signal", ...)` block (lines 266–334). Each test becomes `async` and replaces `handleSignal(tmp, "plan_draft_done")` with `await handlePlanDraftDone(tmp)`:

```typescript
describe("plan_draft_done signal", () => {
  it("transitions planMode from draft to review", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("review mode");

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("transitions planMode from revise to review", async () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeUndefined();

    const state = readState(tmp);
    expect(state.planMode).toBe("review");
  });

  it("returns error when not in plan phase", async () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is review", async () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
  });

  it("returns error when no task files exist", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = await handlePlanDraftDone(tmp);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("task");
  });

  it("reports task count in success message", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T1\nstatus: draft\n---\nB1.");
    writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nB2.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.message).toContain("2 tasks");
  });

  it("sets triggerNewSession flag", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nB.");

    const result = await handlePlanDraftDone(tmp);
    expect(result.triggerNewSession).toBe(true);
  });
});
```

Also migrate the `triggerNewSession` test at line ~824:

```typescript
it("does NOT return triggerNewSession when plan_draft_done fails", async () => {
  setState(tmp, { phase: "implement", planMode: null });
  const result = await handlePlanDraftDone(tmp);
  expect(result.error).toBeDefined();
  expect(result.triggerNewSession).toBeUndefined();
});
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
