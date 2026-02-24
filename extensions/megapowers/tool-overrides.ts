// extensions/megapowers/tool-overrides.ts
//
// Disk-backed wrappers for write/edit tool overrides.

import { readState, writeState } from "./state-io.js";
import { canWrite, isTestFile, isAllowlisted } from "./write-policy.js";
import { deriveTasks } from "./derived.js";

// Re-export for consumers who only want policy utilities
export { isTestFile, isAllowlisted };

// =============================================================================
// Write override
// =============================================================================

export interface WriteOverrideResult {
  allowed: boolean;
  reason?: string;
  /**
   * True when a test file was written. Caller should call recordTestFileWritten()
   * after the write succeeds to persist the TDD state transition.
   */
  updateTddState?: boolean;
}

/**
 * Evaluate whether a write/edit operation is permitted.
 * Reads current state from disk, applies write policy.
 */
export function evaluateWriteOverride(cwd: string, filePath: string): WriteOverrideResult {
  const state = readState(cwd);

  // Derive noTest flag for current task
  let taskIsNoTest = false;
  if (state.activeIssue && (state.phase === "implement" || state.phase === "code-review")) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    const currentTask = tasks[state.currentTaskIndex];
    taskIsNoTest = currentTask?.noTest ?? false;
  }

  const decision = canWrite(state.phase, filePath, state.megaEnabled, taskIsNoTest, state.tddTaskState);

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  // Test file in a TDD phase → caller should record the write for TDD tracking
  const isTddPhase = state.phase === "implement" || state.phase === "code-review";
  if (isTddPhase && state.megaEnabled && isTestFile(filePath)) {
    return { allowed: true, updateTddState: true };
  }

  return { allowed: true };
}

/**
 * After a successful test file write, persist the TDD state transition
 * (no-test → test-written) to disk.
 *
 * Must be called AFTER the write succeeds (not before).
 */
export function recordTestFileWritten(cwd: string): void {
  const state = readState(cwd);

  // Only applies when there is an active issue
  if (!state.activeIssue) return;

  const tasks = deriveTasks(cwd, state.activeIssue);
  const currentTask = tasks[state.currentTaskIndex];
  const taskIndex = currentTask?.index ?? state.currentTaskIndex + 1;

  writeState(cwd, {
    ...state,
    tddTaskState: {
      taskIndex,
      state: "test-written",
      skipped: state.tddTaskState?.skipped ?? false,
    },
  });
}

