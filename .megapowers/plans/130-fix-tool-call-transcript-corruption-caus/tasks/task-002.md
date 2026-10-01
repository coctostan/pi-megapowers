---
id: 2
title: Remove signal session-reset instructions
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
  - extensions/megapowers/plan-orchestrator.ts
files_to_create: []
---

### Task 2: Remove signal session-reset instructions [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`
- Modify: `extensions/megapowers/plan-orchestrator.ts`

Covers Fixed When 1, 3, 5–7. Task 1 must have removed the consumers first. Preserve all workflow state mutations and feedback content except for the explicitly obsolete automatic-session promise in `transitionDraftToReview`. The optional result-field removal is a result contract change, not a state.json schema change.

Grounding: verified `SignalResult`, `handleSignal(cwd, action, target?): SignalResult`, and `handlePlanDraftDone(cwd): Promise<SignalResult>` from source. `impact([SignalResult], signature_change)` found no indexed call-edge dependents; explicit search identified the signal producer, register-tools consumer (already removed by Task 1), and `tests/tool-signal.test.ts`. No other dependent tests require changes.

Revision grounding: `read(symbol)` and `symbol_graph` confirm `transitionDraftToReview(state: MegapowersState, taskCount: number): OrchestratorResult<PlanTransitionResult>` and `composeMessage(args: ComposeArgs): string`. AST search confirms the `composeMessage` call owns the obsolete `nextStep` inside this function. All Step 3 local callees were checked against their current source signatures; Node fs/path helpers remain the existing imports.

**Step 1 — Write the failing test**
Append this COMPLETE describe block at EOF in `tests/tool-signal.test.ts`. Its imports (`describe/it/expect`, fs/temp/path helpers, handlers, state helpers) already exist in that file; it uses its own temporary fixtures rather than another describe's hooks.

```ts
describe("signal session policy", () => {
  it("successful signal transitions return no session-reset instruction", async () => {
    for (const action of ["phase_next", "phase_back", "task_done", "plan_draft_done"] as const) {
      const cwd = mkdtempSync(join(tmpdir(), "signal-policy-"));
      try {
        const dir = join(cwd, ".megapowers", "plans", "001-test");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
        if (action === "plan_draft_done") {
          mkdirSync(join(dir, "tasks"), { recursive: true });
          writeFileSync(join(dir, "tasks", "task-001.md"), "---\nid: 1\ntitle: First\nstatus: draft\n---\nBody.");
        }
        writeState(cwd, {
          ...createInitialState(), activeIssue: "001-test", workflow: "feature",
          phase: action === "phase_next" ? "brainstorm" : action === "phase_back" ? "verify"
            : action === "task_done" ? "implement" : "plan",
          planMode: action === "plan_draft_done" ? "draft" : null,
          planIteration: action === "plan_draft_done" ? 1 : 0,
          tddTaskState: action === "task_done" ? { taskIndex: 1, state: "impl-allowed", skipped: false } : null,
        });
        const result = action === "plan_draft_done" ? await handlePlanDraftDone(cwd) : handleSignal(cwd, action);
        expect(result.error).toBeUndefined();
        if (action === "plan_draft_done") {
          expect(result.message).toContain("current Pi session");
          expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
        }
        expect(result).not.toHaveProperty("triggerNewSession");
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "signal session policy"`
Expected: FAIL. Minimal actual handler probe emitted:
```text
error: expect(received).not.toHaveProperty(path)

Expected path: not "triggerNewSession"

Received value: true
```

The loop initially fails on the `phase_next` no-flag assertion above. Once the obsolete flags are removed, the `plan_draft_done` message assertion independently fails until its producer's next step is corrected:
```text
error: expect(received).toContain(expected)

Expected to contain: "current Pi session"
Received: "📋 Plan draft complete — 1 task saved\n  Next: Transitioning to review mode. A new review session will start."
```
Both failures protect the same session-preservation policy; keep all four action fixtures and the no-flag assertion.

**Step 3 — Write minimal implementation**
Replace the existing interface and these five symbols with the complete bodies below. They differ only by removing the interface field and all five return flags. Keep imports and every other handler unchanged.

```ts
export interface SignalResult {
  message?: string;
  error?: string;
}

function handleTaskDone(cwd: string): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || state.phase !== "implement") {
    return { error: "task_done can only be called during the implement phase." };
  }

  const tasks = deriveTasks(cwd, state.activeIssue);
  if (tasks.length === 0) {
    return { error: "No tasks found. Ensure task files exist in .megapowers/plans/<issue>/tasks/." };
  }

  const currentTask = tasks[state.currentTaskIndex];
  if (!currentTask) {
    return { error: `No task at index ${state.currentTaskIndex}. Tasks: ${tasks.length}` };
  }

  // -----------------------------------------------------------------------
  // AC13 — null-safe TDD validation
  //
  // The null-safety gap: `tdd && tdd.taskIndex === currentTask.index` evaluates
  // to `false` when `tdd` is null (&&-short-circuit), making the surrounding
  // condition treat null as "no constraint violated". We must explicitly treat
  // null as a blocking state for non-[no-test] tasks.
  // -----------------------------------------------------------------------
  if (!currentTask.noTest) {
    const tdd = state.tddTaskState;

    // tddOk is true only when:
    //   - tdd is NOT null, AND
    //   - either (a) it was explicitly skipped, OR
    //            (b) it refers to the current task AND state is impl-allowed
    const tddOk =
      tdd !== null &&
      (tdd.skipped || (tdd.taskIndex === currentTask.index && tdd.state === "impl-allowed"));

    if (!tddOk) {
      const reason =
        tdd === null
          ? "TDD requirements not met. No test file written yet. Write a test file, run tests (they must fail), then implement. Or use /tdd skip to bypass."
          : tdd.taskIndex !== currentTask.index
            ? `TDD state is for task ${tdd.taskIndex} but current task is ${currentTask.index}. TDD state must match the current task.`
            : "TDD requirements not met. Tests have not failed yet (need RED phase). Run tests and ensure they fail before implementing.";
      return { error: reason };
    }
  }

  // Mark complete using PlanTask.index (1-based)
  const completedTasks = [...state.completedTasks, currentTask.index];
  const completedSet = new Set(completedTasks);

  // Find next incomplete task — search forward from current, wrap around
  let nextIncompleteIdx = -1;
  for (let i = state.currentTaskIndex + 1; i < tasks.length; i++) {
    if (!completedSet.has(tasks[i].index)) {
      nextIncompleteIdx = i;
      break;
    }
  }
  if (nextIncompleteIdx === -1) {
    for (let i = 0; i <= state.currentTaskIndex; i++) {
      if (!completedSet.has(tasks[i].index)) {
        nextIncompleteIdx = i;
        break;
      }
    }
  }

  const allDone = tasks.every(t => completedSet.has(t.index));

  if (allDone) {
    // Auto-advance to verify
    const updatedState = {
      ...state,
      completedTasks,
      tddTaskState: null,
    };
    const newState = transition(updatedState, "verify" as Phase);
    writeState(cwd, newState);
    return {
      message: composeMessage({
        icon: "success",
        summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
        changes: [`All ${tasks.length} tasks done`],
        nextStep: "Phase advanced to verify — begin verification.",
      }),
    };
  }

  // Advance to next task
  const nextIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex;
  const nextTask = tasks[nextIdx];
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIdx,
    tddTaskState: null, // Reset TDD state for next task
  };
  writeState(cwd, updatedState);

  const remaining = tasks.length - completedTasks.length;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
      changes: [`${remaining} task${remaining === 1 ? "" : "s"} remaining`],
      nextStep: `Task ${nextTask.index}: ${nextTask.description}`,
    }),
  };
}

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
  };
}

function handlePhaseNext(cwd: string, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: composeMessage({
      icon: "info",
      summary: `Phase advanced to ${result.newPhase}`,
      nextStep: `Proceed with ${result.newPhase} phase work.`,
    }),
  };
}

function handlePhaseBack(cwd: string): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { error: "No active issue or phase." };
  }

  const config = getWorkflowConfig(state.workflow);
  const backwardTransition = config.transitions.find(
    (t) => t.from === state.phase && t.backward === true,
  );

  if (!backwardTransition) {
    return {
      error: `No backward transition from ${state.phase} in ${state.workflow} workflow.`,
    };
  }

  // Note: reviewApproved is reset by transition() in state-machine.ts
  // when to === "plan". No explicit intermediate write needed here.

  const planDir = join(cwd, ".megapowers", "plans", state.activeIssue);

  // Auto-version artifacts on backward transitions (AC13-AC16)
  if (backwardTransition.from === "review" && backwardTransition.to === "plan") {
    versionArtifact(planDir, "review.md");
    versionArtifact(planDir, "plan.md");
  }
  if (backwardTransition.from === "verify" && backwardTransition.to === "implement") {
    versionArtifact(planDir, "verify.md");
  }
  if (backwardTransition.from === "code-review" && backwardTransition.to === "implement") {
    versionArtifact(planDir, "code-review.md");
  }
  const result = advancePhase(cwd, backwardTransition.to);
  if (!result.ok) {
    return { error: result.error };
  }

  return {
    message: composeMessage({
      icon: "warn",
      summary: `Phase moved back to ${result.newPhase}`,
      changes: ["Rework needed"],
      nextStep: `Continue with the ${result.newPhase} phase.`,
    }),
  };
}
```

In `extensions/megapowers/plan-orchestrator.ts`, inside `transitionDraftToReview(state: MegapowersState, taskCount: number): OrchestratorResult<PlanTransitionResult>`, replace ONLY:
```ts
        nextStep: "Transitioning to review mode. A new review session will start.",
```
with:
```ts
        nextStep: "Review mode is active in the current Pi session. Continue with plan review.",
```
Keep its guards, `nextState`, summary and task count unchanged. Do not replace the whole orchestrator file or change any other transition.

Retire obsolete test expectations in `tests/tool-signal.test.ts`. Replace every exact occurrence of either of these lines:
```ts
expect(result.triggerNewSession).toBe(true);
expect(result.triggerNewSession).toBeUndefined();
```
with:
```ts
expect(result).not.toHaveProperty("triggerNewSession");
```
Keep ALL surrounding state, gate, message, and TDD assertions. Rename the five former positive-reset tests to:
- `omits session-reset instructions when auto-advancing to verify`
- `omits session-reset instructions when advancing to the next task`
- `omits session-reset instructions when entering review mode`
- `omits session-reset instructions on phase advance`
- `omits session-reset instructions on backward transition`

The error/non-transition test groups should be named `session policy — error cases` and `session policy — non-transition actions`; their case titles should say `omits session-reset instructions` rather than referring to reading a removed typed property. String-key negative assertions are intentional behavioral regressions.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "signal session policy"`
Expected: PASS. Also run `bun test tests/tool-signal.test.ts tests/plan-orchestrator.test.ts` to check updated legacy cases and unchanged orchestrator behavior.

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing.
