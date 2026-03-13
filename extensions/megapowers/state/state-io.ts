// extensions/megapowers/state/state-io.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInitialState, type MegapowersState } from "./state-machine.js";

const STATE_DIR = ".megapowers";
const STATE_FILE = "state.json";

/** Keys allowed in MegapowersState — everything else is stripped on read. */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "planMode", "planIteration", "currentTaskIndex", "completedTasks",
  "tddTaskState", "doneActions", "doneChecklistShown", "megaEnabled", "branchName", "baseBranch",
]);

export function readState(cwd: string): MegapowersState {
  const filePath = join(cwd, STATE_DIR, STATE_FILE);
  if (!existsSync(filePath)) return createInitialState();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    // Pick only known keys, merge over defaults
    const defaults = createInitialState();
    const picked: Record<string, any> = {};
    for (const key of KNOWN_KEYS) {
      if (key in raw) picked[key] = raw[key];
    }
    return { ...defaults, ...picked } as MegapowersState;
  } catch {
    return createInitialState();
  }
}

export function writeState(cwd: string, state: MegapowersState): void {
  const dir = join(cwd, STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, STATE_FILE);
  const tmpPath = join(dir, `.state-${randomUUID()}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmpPath, filePath);
}
