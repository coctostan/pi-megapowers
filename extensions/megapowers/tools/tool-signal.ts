// extensions/megapowers/tools/tool-signal.ts
import { join } from "node:path";
import { readState, writeState } from "../state/state-io.js";
import { listPlanTasks } from "../state/plan-store.js";
import { advancePhase } from "../policy/phase-advance.js";
import { deriveTasks } from "../state/derived.js";
import { transition, type Phase } from "../state/state-machine.js";
import { getWorkflowConfig } from "../workflows/registry.js";
import { versionArtifact } from "../artifacts/version-artifact.js";

export interface SignalResult {
  message?: string;
  error?: string;
  triggerNewSession?: boolean;
}

export function handleSignal(
  cwd: string,
  action:
    | "task_done"
    | "review_approve"
    | "phase_next"
    | "phase_back"
    | "tests_failed"
    | "tests_passed"
    | "plan_draft_done"
    | string,
  target?: string,
): SignalResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  switch (action) {
    case "task_done":
      return handleTaskDone(cwd);
    case "review_approve":
      return handleReviewApprove(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, target);
    case "phase_back":
      return handlePhaseBack(cwd);
    case "tests_failed":
      return handleTestsFailed(cwd);
    case "tests_passed":
      return handleTestsPassed(cwd);
    case "plan_draft_done":
      return handlePlanDraftDone(cwd);
    default:
      return { error: `Unknown signal action: ${String(action)}` };
  }
}

// ---------------------------------------------------------------------------
// task_done
// ---------------------------------------------------------------------------

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
      message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.`,
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
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
}

// ---------------------------------------------------------------------------

function handleTestsFailed(cwd: string): SignalResult {
  const state = readState(cwd);

  if (state.phase !== "implement" && state.phase !== "code-review") {
    return { error: "tests_failed can only be called during the implement or code-review phase." };
  }

  if (!state.tddTaskState || state.tddTaskState.state !== "test-written") {
    if (state.tddTaskState?.state === "impl-allowed") {
      return { error: "TDD state is already in impl-allowed." };
    }
    return { error: "No test written yet, or tests have not failed yet." };
  }

  writeState(cwd, {
    ...state,
    tddTaskState: { ...state.tddTaskState, state: "impl-allowed" },
  });

  return { message: "Tests failed (RED ✓). Production code writes are now allowed." };
}

// ---------------------------------------------------------------------------
// tests_passed
// ---------------------------------------------------------------------------

function handleTestsPassed(cwd: string): SignalResult {
  const state = readState(cwd);

  if (state.phase !== "implement" && state.phase !== "code-review") {
    return { error: "tests_passed can only be called during the implement or code-review phase." };
  }

  return { message: "Tests passed (GREEN ✓)." };
}

// ---------------------------------------------------------------------------
// plan_draft_done
// ---------------------------------------------------------------------------

function handlePlanDraftDone(cwd: string): SignalResult {
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
      "  → Transitioning to review mode. newSession() should be called (see Task 18 wiring).",
    triggerNewSession: true,
  };
}


// ---------------------------------------------------------------------------
// review_approve
// ---------------------------------------------------------------------------

function handleReviewApprove(_cwd: string): SignalResult {
  return {
    error: "❌ review_approve is deprecated. Plan review is now handled by the megapowers_plan_review tool within the plan phase. The reviewer calls megapowers_plan_review({ verdict: \"approve\", ... }) to approve.",
  };
}


// ---------------------------------------------------------------------------
// phase_next
// ---------------------------------------------------------------------------

function handlePhaseNext(cwd: string, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.`,
  };
}

// ---------------------------------------------------------------------------
// phase_back
// ---------------------------------------------------------------------------

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
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
  };
}
