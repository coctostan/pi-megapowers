// extensions/megapowers/tool-signal.ts
import { readState, writeState } from "./state-io.js";
import { advancePhase } from "./phase-advance.js";
import { deriveTasks } from "./derived.js";
import { transition, type Phase } from "./state-machine.js";
import type { JJ } from "./jj.js";

export interface SignalResult {
  message?: string;
  error?: string;
}

export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | string,
  jj?: JJ,
): SignalResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  switch (action) {
    case "task_done":
      return handleTaskDone(cwd, jj);
    case "review_approve":
      return handleReviewApprove(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, jj);
    default:
      return { error: `Unknown signal action: ${String(action)}` };
  }
}

// ---------------------------------------------------------------------------
// task_done
// ---------------------------------------------------------------------------

function handleTaskDone(cwd: string, _jj?: JJ): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || state.phase !== "implement") {
    return { error: "task_done can only be called during the implement phase." };
  }

  const tasks = deriveTasks(cwd, state.activeIssue);
  if (tasks.length === 0) {
    return { error: "No tasks found in plan.md. Check the plan format." };
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
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex,
    tddTaskState: null, // Reset TDD state for next task
  };
  writeState(cwd, updatedState);

  const nextTask = tasks[updatedState.currentTaskIndex];
  const remaining = tasks.length - completedTasks.length;
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
}

// ---------------------------------------------------------------------------
// review_approve
// ---------------------------------------------------------------------------

function handleReviewApprove(cwd: string): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue) {
    return { error: "No active issue." };
  }

  writeState(cwd, { ...state, reviewApproved: true });
  return {
    message: "Plan review approved. Call megapowers_signal with action 'phase_next' to advance to implement.",
  };
}

// ---------------------------------------------------------------------------
// phase_next
// ---------------------------------------------------------------------------

function handlePhaseNext(cwd: string, jj?: JJ): SignalResult {
  const result = advancePhase(cwd, undefined, jj);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.`,
  };
}
