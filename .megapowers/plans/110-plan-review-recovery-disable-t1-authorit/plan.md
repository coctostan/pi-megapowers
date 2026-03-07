# Plan

### Task 1: Restore reviewer ownership wording in review-plan prompt

### Task 1: Restore reviewer ownership wording in review-plan prompt

Covers Fixed When: 1

**Files:**
- Modify: `prompts/review-plan.md`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**
Add this test inside `describe("buildInjectedPrompt — plan mode routing", ...)` in `tests/prompt-inject.test.ts`:

```ts
it("review-plan prompt keeps reviewer ownership even after deterministic checks", () => {
  setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });

  const result = buildInjectedPrompt(tmp);

  expect(result).not.toBeNull();
  expect(result).toContain("Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval.");
  expect(result).toContain("You still own the full review verdict.");
  expect(result).toContain("Review each task in order: coverage, dependencies, TDD correctness, then self-containment/codebase realism.");
  expect(result).not.toContain("The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1).");
  expect(result).not.toContain("Focus your review entirely on higher-order concerns");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts -t "review-plan prompt keeps reviewer ownership even after deterministic checks"`
Expected: FAIL — `expect(received).toContain(expected)` because the injected prompt still contains the old T0/T1-authoritative wording and does not contain `Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval.`

**Step 3 — Write minimal implementation**
In `prompts/review-plan.md`, replace the paragraph under `## Evaluate against these criteria:` and the self-containment note so the prompt says:

```md
Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval. You still own the full review verdict. Re-check coverage, dependency ordering, TDD completeness, self-containment, and codebase realism yourself before approving or requesting revisions.

Review each task in order: coverage, dependencies, TDD correctness, then self-containment/codebase realism.
```

Also replace the parenthetical at the end of `### 6. Self-Containment` with:

```md
(Earlier structural checks may be helpful hints, but you must still verify file paths, descriptions, imports, APIs, and error handling yourself.)
```

Keep the existing per-task assessment format, verdict section, and revise-instructions handoff text unchanged.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts -t "review-plan prompt keeps reviewer ownership even after deterministic checks"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: Remove T1 gating from handlePlanDraftDone [depends: 1]

### Task 2: Remove T1 gating from handlePlanDraftDone [depends: 1]

Covers Fixed When: 2

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

`tests/tool-signal.test.ts` already exists and already contains `describe("plan_draft_done signal", ...)`, `describe("handlePlanDraftDone — async T1 lint integration", ...)`, and `describe("handlePlanDraftDone — graceful degradation", ...)`. This task updates that existing coverage to match the restored simple-transition contract.

**Step 1 — Write the failing test**
In the existing `tests/tool-signal.test.ts` file, keep the current `describe("plan_draft_done signal", ...)` block and replace the current T1-specific coverage at the bottom of the file with this regression test:

```ts
it("ignores failing model lint input and still transitions to review", async () => {
  const tmp2 = mkdtempSync(join(tmpdir(), "tool-signal-plan-draft-done-no-t1-"));

  try {
    writeState(tmp2, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
    });

    const tasksDir = join(tmp2, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(
      join(tasksDir, "task-001.md"),
      "---\nid: 1\ntitle: Task 1\nstatus: draft\ndepends_on: []\nno_test: false\nfiles_to_modify: [src/foo.ts]\nfiles_to_create: []\n---\n" + "A".repeat(220),
    );
    writeFileSync(
      join(tmp2, ".megapowers", "plans", "001-test", "spec.md"),
      "## Acceptance Criteria\n1. AC1",
    );

    const failFn = async () => JSON.stringify({
      verdict: "fail",
      findings: ["AC1 is not covered by any task"],
    });

    const result = await (handlePlanDraftDone as any)(tmp2, failFn);

    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
    expect(result.message).toContain("Transitioning to review mode");
    expect(result.message).not.toContain("T1");
    expect(readState(tmp2).planMode).toBe("review");
  } finally {
    rmSync(tmp2, { recursive: true, force: true });
  }
});
```

Delete the existing `describe("handlePlanDraftDone — async T1 lint integration", ...)` block and the existing `describe("handlePlanDraftDone — graceful degradation", ...)` block, because those two blocks are the current buggy contract and already exist in the file today.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "ignores failing model lint input and still transitions to review"`
Expected: FAIL — `expect(received).toBeUndefined()` with `Received: "❌ T1 plan lint failed:\n  • AC1 is not covered by any task"`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-signal.ts`:

1. Remove the `deriveAcceptanceCriteria` import.
2. Remove the `lintPlanWithModel` / `CompleteFn` import.
3. Change the function signature back to a simple transition helper:

```ts
export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
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

  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      "  → Transitioning to review mode.",
    triggerNewSession: true,
  };
}
```

Do not leave any T1 warning strings, `criteriaText`, `taskSummaries`, or `lintResult` logic in the function.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "ignores failing model lint input and still transitions to review"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Remove T1 model wiring from register-tools [depends: 2]

### Task 3: Remove T1 model wiring from register-tools [depends: 2]

Covers Fixed When: 3, 4

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

`tests/register-tools.test.ts` already exists and already reads `extensions/megapowers/register-tools.ts` as source text for wiring assertions. This task adds one more source-level regression test to that existing file and keeps `tests/new-session-wiring.test.ts` as the runtime guard for `newSession()` behavior.

**Step 1 — Write the failing test**
Add this test to the existing `tests/register-tools.test.ts` file:

```ts
it("plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

  expect(source).not.toContain("buildLintCompleteFn");
  expect(source).not.toContain('import { complete } from "@mariozechner/pi-ai"');
  expect(source).not.toContain('import type { CompleteFn } from "./validation/plan-lint-model.js"');
  expect(source).not.toContain('import type { ModelRegistry } from "@mariozechner/pi-coding-agent"');
  expect(source).toContain("result = await handlePlanDraftDone(ctx.cwd);");
});
```

This keeps the existing `tests/new-session-wiring.test.ts` coverage for the session restart behavior and adds a focused regression test for the hidden T1 wiring that currently exists in `register-tools.ts`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts -t "plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers"`
Expected: FAIL — `expect(received).not.toContain(expected)` because `extensions/megapowers/register-tools.ts` still contains `buildLintCompleteFn` and `result = await handlePlanDraftDone(ctx.cwd, completeFn);`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/register-tools.ts`:

1. Remove these imports because they only support T1 wiring:

```ts
import { complete } from "@mariozechner/pi-ai";
import type { CompleteFn } from "./validation/plan-lint-model.js";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
```

2. Delete the entire helper:

```ts
async function buildLintCompleteFn(modelRegistry: ModelRegistry | undefined): Promise<CompleteFn | undefined> {
  // ...delete this whole function...
}
```

3. Update the existing `megapowers_signal` execute branch to call `handlePlanDraftDone` directly:

```ts
if (params.action === "plan_draft_done") {
  result = await handlePlanDraftDone(ctx.cwd);
} else {
  result = handleSignal(ctx.cwd, params.action, params.target);
}
```

Leave the existing `triggerNewSession` handling unchanged so `tests/new-session-wiring.test.ts` continues to pass.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts -t "plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
