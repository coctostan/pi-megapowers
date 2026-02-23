// extensions/megapowers/tool-overrides.ts
//
// Disk-backed wrappers for write/edit/bash tool overrides.
//
// Key design for bash override (AC32-34, Task 8 fix):
//   createBashTool THROWS on non-zero exit (confirmed from pi source).
//   Our bash override wraps it in try/catch:
//     - catch block → isError = true → processBashResult(cwd, cmd, true) → impl-allowed
//     - success path → isError = false → processBashResult(cwd, cmd, false) → no change
//   This is explicit and correct — NOT regex on result text like "/exit code [1-9]/".

import { readState, writeState } from "./state-io.js";
import { canWrite, isTestFile, isAllowlisted, isTestRunnerCommand } from "./write-policy.js";
import { deriveTasks } from "./derived.js";

// Re-export for consumers who only want policy utilities
export { isTestFile, isAllowlisted, isTestRunnerCommand };

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

// =============================================================================
// Bash override — processBashResult
//
// DESIGN (Task 8 fix — AC32-34):
//
// createBashTool from @mariozechner/pi-coding-agent throws (rejects) when
// the command exits with a non-zero code. The message ends with:
//   "Command exited with code N"
//
// Our bash override wraps the built-in execute in try/catch:
//
//   try {
//     const result = await builtinBash.execute(...);
//     processBashResult(cwd, command, false);  // zero exit
//     return result;
//   } catch (err) {
//     processBashResult(cwd, command, true);   // non-zero exit
//     throw err;  // re-throw so pi handles error display
//   }
//
// isError=true means the command failed → tests are RED → impl-allowed.
// isError=false means the command succeeded → tests passed → stay at test-written.
//
// We do NOT inspect the error message text for patterns like /exit code [1-9]/.
// The boolean is the authoritative signal.
// =============================================================================

/**
 * Process the result of a bash command for TDD state tracking.
 *
 * @param cwd     - Working directory (for state I/O)
 * @param command - The bash command that was executed
 * @param isError - true = command threw/failed (non-zero exit from createBashTool),
 *                  false = command succeeded (zero exit)
 */
export function processBashResult(cwd: string, command: string, isError: boolean): void {
  const state = readState(cwd);

  // Only active in implement/code-review with mega on
  if (!state.megaEnabled) return;
  if (state.phase !== "implement" && state.phase !== "code-review") return;

  // Only relevant when in test-written state (waiting for RED confirmation)
  if (!state.tddTaskState || state.tddTaskState.state !== "test-written") return;

  // Only test runner commands count
  if (!isTestRunnerCommand(command)) return;

  // isError=true → command exited non-zero → tests are RED → allow impl
  if (isError) {
    writeState(cwd, {
      ...state,
      tddTaskState: { ...state.tddTaskState, state: "impl-allowed" },
    });
  }
  // isError=false → tests passed → do NOT transition (stay at test-written)
  // This handles: tests were already passing before the RED step
}
