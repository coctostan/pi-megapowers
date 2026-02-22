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
  if (fileState.activeIssue) {
    return fileState;
  }
  let state = fileState;
  for (const entry of sessionEntryStates) {
    state = entry;
  }
  return state;
}
