---
id: 10
title: Add graceful degradation when T1 API key is unavailable
status: approved
depends_on:
  - 9
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Covers:** AC16

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

describe("handlePlanDraftDone — graceful degradation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-t1-graceful-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeValidTask() {
    const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "task-001.md"),
      "---\nid: 1\ntitle: T1\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/a.ts]\nfiles_to_create: []\n---\n" + "A".repeat(220),
    );
  }

  it("adds warning when completeFn is unavailable (no API key)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeValidTask();

    const result = await handlePlanDraftDone(tmp, undefined);

    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("⚠️");
    expect(result.message).toContain("skipped");
    expect(readState(tmp).planMode).toBe("review");
  });

  it("adds warning when model response is malformed (fail-open)", async () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, workflow: "feature" });
    writeValidTask();

    const malformedFn = async () => "not-json";
    const result = await handlePlanDraftDone(tmp, malformedFn);
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("⚠️");
    expect(result.message).toContain("malformed");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `Expected substring: "⚠️"\nReceived string: "📝 Draft complete: 1 task saved\n  → Transitioning to review mode."`.

**Step 3 — Write minimal implementation**
Update `handlePlanDraftDone` in `extensions/megapowers/tools/tool-signal.ts` with the full if/else body (showing where `criteria` and `taskSummaries` live):
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
  if (!completeFn) {
    // T1 skipped — no API key available
    lintWarning = "\n  ⚠️ T1 lint skipped: no model API key available.";
  } else {
    // T1 lint: criteria and taskSummaries are inside the else block
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
This satisfies both warning paths:
- `completeFn` unavailable (API key missing) — sets warning in the `if (!completeFn)` branch
- malformed model response (warning surfaced from `lintPlanWithModel`) — sets warning in the `else` branch
**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
