import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

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
  if (ctx.env.PI_SUBAGENT === "1") return true;
  const depth = ctx.env.PI_SUBAGENT_DEPTH;
  return typeof depth === "string" && depth.length > 0 && depth !== "0";
}

/**
 * Resolve the project root for state reads.
 * In satellite mode (subagent), the cwd is the jj workspace dir which
 * doesn't have .megapowers/state.json. Walks up the directory tree to find it.
 * MEGA_PROJECT_ROOT takes priority if set.
 */
function hasMegapowersStateJson(dir: string): boolean {
  return existsSync(join(dir, ".megapowers", "state.json"));
}
export function resolveProjectRoot(
  cwd: string,
  env: Record<string, string | undefined>,
): string {
  const projectRoot = env.MEGA_PROJECT_ROOT;
  if (projectRoot && projectRoot.length > 0) return projectRoot;
  let current = cwd;
  while (true) {
    if (hasMegapowersStateJson(current)) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return cwd;
}

// --- Satellite setup ---

/**
 * Set up satellite mode.
 * Called from index.ts when isSatelliteMode() returns true.
 *
 * Satellite (subagent) sessions run in isolated jj workspaces.
 * In this architecture, TDD is guided by prompts and audited after the implement step,
 * not enforced via write-blocking tool hooks.
 */
export function setupSatellite(_pi: ExtensionAPI): void {
  // No-op: TDD is audited post-hoc by the pipeline runner, not enforced via hooks.
}

