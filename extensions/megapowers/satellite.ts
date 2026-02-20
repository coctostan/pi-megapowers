import { createStore } from "./store.js";
import type { MegapowersState } from "./state-machine.js";

// --- Detection ---

export interface SatelliteDetectionContext {
  isTTY: boolean | undefined;
  env: Record<string, string | undefined>;
}

/**
 * Detect if the current session is running as a satellite (subagent).
 *
 * A session is satellite if:
 * - PI_SUBAGENT=1 is set in environment
 * - No TTY is attached (isTTY is explicitly false)
 *
 * When isTTY is undefined (ambiguous), we don't assume satellite.
 */
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  if (ctx.env.PI_SUBAGENT === "1") return true;
  if (ctx.isTTY === false) return true;
  return false;
}

// --- Read-only state loading ---

export function loadSatelliteState(projectRoot: string): Readonly<MegapowersState> {
  const store = createStore(projectRoot);
  const state = store.loadState();
  return Object.freeze(state);
}
