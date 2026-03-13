---
id: 6
title: Delegate plan_draft_done and remove review_approve from tool-signal
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 6: Delegate `plan_draft_done` and remove `review_approve` from tool-signal [depends: 2]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**
In `tests/tool-signal.test.ts`, replace the existing `describe("review_approve deprecation", ...)` block with this exact code:

```ts
describe("review_approve removal", () => {
  it("treats review_approve as an unknown signal action and removes the old switch case", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf-8");
    expect(source).not.toContain('| "review_approve"');
    expect(source).not.toContain('case "review_approve"');

    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    const result = handleSignal(tmp, "review_approve");
    expect(result.error).toBe("Unknown signal action: review_approve");
  });
});
```

Then replace the existing test named `it("does not clear reviewApproved when review → plan transition is invalid", ...)` with this exact code:

```ts
it("leaves phase state untouched when review → plan transition is invalid", () => {
  writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
  setState(tmp, { phase: "review" });
  const before = readState(tmp);

  const result = handleSignal(tmp, "phase_back");

  expect(result.error).toBeDefined();
  expect(result.error).toContain("No backward transition");
  expect(readState(tmp).phase).toBe("review");
  expect(readState(tmp).phaseHistory).toEqual(before.phaseHistory);
});
```

Then replace the existing schema assertion test named `it("does not advertise review_approve while the low-level deprecation error remains", ...)` with this exact code:

```ts
it("does not advertise review_approve and routes plan_draft_done through plan-orchestrator", async () => {
  const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
  const signalSource = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf8");

  expect(toolsSource).not.toContain('Type.Literal("review_approve")');
  expect(signalSource).toContain("transitionDraftToReview");
  expect(signalSource).not.toContain('writeState(cwd, { ...state, planMode: "review" })');

  setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
  const result = handleSignal(tmp, "review_approve");
  expect(result.error).toBe("Unknown signal action: review_approve");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — `expect(received).not.toContain('| "review_approve"')`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-signal.ts`, add this import near the top:

```ts
import { transitionDraftToReview } from "../plan-orchestrator.js";
```

Then change the `handleSignal(...)` action union so it reads:

```ts
export function handleSignal(
  cwd: string,
  action:
    | "task_done"
    | "phase_next"
    | "phase_back"
    | "tests_failed"
    | "tests_passed"
    | "plan_draft_done"
    | "close_issue"
    | string,
  target?: string,
): SignalResult {
```

Then remove the `case "review_approve":` branch from the switch entirely so the switch reads:

```ts
  switch (action) {
    case "task_done":
      return handleTaskDone(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, target);
    case "phase_back":
      return handlePhaseBack(cwd);
    case "tests_failed":
      return handleTestsFailed(cwd);
    case "tests_passed":
      return handleTestsPassed(cwd);
    case "plan_draft_done":
      return { error: "plan_draft_done must be called via the async handlePlanDraftDone export." };
    case "close_issue":
      return handleCloseIssue(cwd);
    default:
      return { error: `Unknown signal action: ${String(action)}` };
  }
```

Then replace `handlePlanDraftDone(...)` with this exact function:

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

  const orchestrated = transitionDraftToReview(state, tasks.length);
  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  writeState(cwd, orchestrated.value.nextState);
  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

Finally, delete the entire `handleReviewApprove(...)` function.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
