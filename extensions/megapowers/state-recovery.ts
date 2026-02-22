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
  // File state is ALWAYS authoritative. Period.
  // If it has an active issue, use it.
  // If it has no active issue, that means the issue was completed or reset — respect that.
  // Session entries are never used. They caused state resurrection bugs.
  return fileState;
}
