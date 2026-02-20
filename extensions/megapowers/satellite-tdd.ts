import type { MegapowersState } from "./state-machine.js";
import type { TddTaskState } from "./tdd-guard.js";
import { checkFileWrite } from "./tdd-guard.js";

/**
 * Initialize mutable TDD state for a satellite session.
 * Returns null if not in implement phase or no tasks.
 */
export function createSatelliteTddState(
  state: Readonly<MegapowersState>
): TddTaskState | null {
  if (state.phase !== "implement") return null;
  if (state.planTasks.length === 0) return null;

  const currentTask = state.planTasks[state.currentTaskIndex];
  if (!currentTask) return null;

  if (state.tddTaskState) {
    // Clone from parent — mutable copy
    return { ...state.tddTaskState };
  }

  return {
    taskIndex: currentTask.index,
    state: "no-test",
    skipped: false,
  };
}

export interface SatelliteToolCallResult {
  block: boolean;
  reason?: string;
}

/**
 * Handle a tool_call event in satellite mode.
 * Mutates tddState in place when state transitions occur.
 * Returns null if the tool call is not relevant (not write/edit, no path, etc.).
 * Returns { block, reason } if it's a write/edit that was evaluated.
 */
export function handleSatelliteToolCall(
  toolName: string,
  filePath: string | undefined,
  state: Readonly<MegapowersState>,
  tddState: TddTaskState
): SatelliteToolCallResult | null {
  if (toolName !== "write" && toolName !== "edit") return null;
  if (!filePath) return null;

  const currentTask = state.planTasks[state.currentTaskIndex];
  if (!currentTask) return null;

  const result = checkFileWrite(filePath, state.phase, currentTask, tddState);

  // Apply state transition in place (mutable satellite TDD state)
  if (result.newState) {
    tddState.state = result.newState;
  }

  if (!result.allow) {
    return { block: true, reason: result.reason };
  }

  return { block: false };
}
