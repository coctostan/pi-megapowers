// extensions/megapowers/write-policy.ts
//
// Pure write-policy functions — no disk I/O, no pi imports.
// Used by tool-overrides.ts (disk-based) and satellite mode (in-memory).

import type { Phase, TddTaskState } from "./state-machine.js";

export interface WriteDecision {
  allowed: boolean;
  reason?: string;
}

// --- File classification ---

const TEST_FILE_PATTERNS = [/\.test\.[^/]+$/, /\.spec\.[^/]+$/];
const TEST_DIR_PATTERNS = [/(^|\/)tests?\//, /(^|\/)__tests__\//];

export function isTestFile(filePath: string): boolean {
  for (const p of TEST_FILE_PATTERNS) if (p.test(filePath)) return true;
  for (const p of TEST_DIR_PATTERNS) if (p.test(filePath)) return true;
  return false;
}

const ALLOWLIST_PATTERNS = [
  /\.json$/, /\.ya?ml$/, /\.toml$/, /\.env(\..*)?$/,
  /\.d\.ts$/, /\.md$/, /\.config\.[^/]+$/,
];

export function isAllowlisted(filePath: string): boolean {
  for (const p of ALLOWLIST_PATTERNS) if (p.test(filePath)) return true;
  return false;
}

// --- Phase classification ---

/** Phases where source code writes are completely blocked (only .megapowers/ and allowlisted allowed). */
const BLOCKING_PHASES: ReadonlySet<string> = new Set([
  "brainstorm", "spec", "plan", "review", "verify", "done",
  "reproduce", "diagnose",
]);

/** Phases where writes require TDD gating (tests before production code). */
const TDD_PHASES: ReadonlySet<string> = new Set(["implement", "code-review"]);

// --- Core write policy ---

/**
 * Determine whether a file write is allowed given the current phase and TDD state.
 *
 * Pure function — no side effects.
 *
 * @param phase - Current workflow phase (null = no active workflow, allow all)
 * @param filePath - Relative path of the file being written
 * @param megaEnabled - Whether megapowers enforcement is active
 * @param taskIsNoTest - Whether the current task is marked [no-test]
 * @param tddState - Current TDD task state (null = no TDD state recorded yet)
 */
export function canWrite(
  phase: Phase | null,
  filePath: string,
  megaEnabled: boolean,
  taskIsNoTest: boolean,
  tddState: TddTaskState | null,
): WriteDecision {
  // mega off → pass through everything
  if (!megaEnabled) return { allowed: true };

  // no active phase → pass through
  if (!phase) return { allowed: true };

  // .megapowers/ paths always writable (artifact saves, state updates)
  if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
    return { allowed: true };
  }

  // Allowlisted files (docs, config, typings) pass through in ALL phases
  if (isAllowlisted(filePath)) return { allowed: true };

  // Blocking phases: only .megapowers/ and allowlisted files pass (handled above)
  if (BLOCKING_PHASES.has(phase)) {
    return {
      allowed: false,
      reason: `Source code writes are blocked during the ${phase} phase. Only .megapowers/ and allowlisted paths (docs, config, typings) are writable.`,
    };
  }

  // TDD-guarded phases
  if (TDD_PHASES.has(phase)) {

    // Test files always allowed (this is how the RED step happens)
    if (isTestFile(filePath)) return { allowed: true };

    // [no-test] task: no TDD required
    if (taskIsNoTest) return { allowed: true };

    // Explicitly skipped TDD
    if (tddState?.skipped) return { allowed: true };

    // Tests have failed (RED ✓), impl is now allowed (GREEN)
    if (tddState?.state === "impl-allowed") return { allowed: true };

    // Everything else is blocked until TDD is satisfied
    return {
      allowed: false,
      reason:
        "TDD violation: write a test file and run tests (they must fail) before writing production code." +
        " Or use /tdd skip to bypass for this task.",
    };
  }

  return { allowed: true };
}
