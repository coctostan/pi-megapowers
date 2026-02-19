import type { PlanTask } from "./state-machine.js";

// --- Types ---

export type TddState = "no-test" | "test-written" | "impl-allowed";

export interface TddTaskState {
  taskIndex: number;
  state: TddState;
  skipped: boolean;
  skipReason?: string;
}

// --- File classification ---

const TEST_FILE_PATTERNS = [
  /\.test\.[^/]+$/,
  /\.spec\.[^/]+$/,
];

const TEST_DIR_PATTERNS = [
  /(^|\/)tests?\//,
  /(^|\/)__tests__\//,
];

export function isTestFile(filePath: string): boolean {
  for (const pattern of TEST_FILE_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  for (const pattern of TEST_DIR_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

const ALLOWLIST_EXTENSIONS = [
  /\.json$/,
  /\.ya?ml$/,
  /\.toml$/,
  /\.env(\..*)?$/,
  /\.d\.ts$/,
  /\.md$/,
  /\.config\.[^/]+$/,
];

export function isAllowlisted(filePath: string): boolean {
  for (const pattern of ALLOWLIST_EXTENSIONS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

// --- Test runner detection ---

const TEST_RUNNER_PATTERNS = [
  /\bbun\s+test\b/,
  /\bnpm\s+test\b/,
  /\bnpx\s+(jest|vitest|mocha)\b/,
  /\bpytest\b/,
  /\bpython\s+-m\s+pytest\b/,
  /\bcargo\s+test\b/,
  /\bgo\s+test\b/,
  /\bdeno\s+test\b/,
  /\bnpm\s+run\s+test\b/,
];

export function isTestRunnerCommand(command: string): boolean {
  for (const pattern of TEST_RUNNER_PATTERNS) {
    if (pattern.test(command)) return true;
  }
  return false;
}

// --- Core gating ---

export interface FileWriteResult {
  allow: boolean;
  reason?: string;
  newState?: TddState;
}

export function checkFileWrite(
  filePath: string,
  phase: string | null,
  currentTask: PlanTask,
  taskState: TddTaskState
): FileWriteResult {
  // Not in implement phase — pass through
  if (phase !== "implement") {
    return { allow: true };
  }

  // Allowlisted files — always pass
  if (isAllowlisted(filePath)) {
    return { allow: true };
  }

  // Task marked [no-test] — pass through
  if (currentTask.noTest) {
    return { allow: true };
  }

  // Task skipped at runtime — pass through
  if (taskState.skipped) {
    return { allow: true };
  }

  // Test file — advance state if needed, allow
  if (isTestFile(filePath)) {
    if (taskState.state === "no-test") {
      return { allow: true, newState: "test-written" };
    }
    return { allow: true };
  }

  // Production file — check state
  if (taskState.state === "impl-allowed") {
    return { allow: true };
  }

  // Block
  return {
    allow: false,
    reason: "TDD violation: this file write was blocked by tdd-guard because no failing test exists for the current task. Ask the user whether this task needs a test or if it's safe to skip TDD for this file.",
  };
}

// --- State transitions ---

export function handleTestResult(exitCode: number, currentState: TddState): TddState {
  if (currentState !== "test-written") return currentState;
  if (exitCode !== 0) return "impl-allowed";
  return "test-written";
}
