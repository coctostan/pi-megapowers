// --- Detection ---

export interface SatelliteDetectionContext {
  isTTY: boolean | undefined;
  env: Record<string, string | undefined>;
}

/**
 * Detect if the current session is running as a satellite (subagent).
 *
 * A session is satellite only when PI_SUBAGENT=1 is set in environment.
 * This is the explicit signal from the pi subagent tool.
 *
 * We no longer use isTTY === false as a signal because non-interactive
 * contexts (CI, piped output) would incorrectly skip primary features.
 */
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  return ctx.env.PI_SUBAGENT === "1";
}

