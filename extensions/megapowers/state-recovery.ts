import type { MegapowersState } from "./state-machine.js";

/**
 * Resolve which state to use at startup.
 * state.json is authoritative when it has an active issue.
 * Session entries are only used for crash recovery (when state.json is empty/initial).
 */
export function resolveStartupState(
  fileState: MegapowersState,
  sessionEntryStates: MegapowersState[]
): MegapowersState {
  // File state is always authoritative — if it has an active issue, use it.
  // If it has no active issue, that's intentional (issue was completed/reset).
  // Only recover from session entries if file state is initial AND there are
  // session entries with a non-done active issue (crash recovery scenario).
  if (fileState.activeIssue) {
    return fileState;
  }
  // Only use session entries for crash recovery — never restore a "done" phase
  for (const entry of sessionEntryStates) {
    if (entry.activeIssue && entry.phase && entry.phase !== "done") {
      return entry;
    }
  }
  return fileState;
}
