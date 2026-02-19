import type { PlanTask } from "./state-machine.js";

// --- Types ---

export type TddState = "no-test" | "test-written" | "test-failing" | "impl-allowed";

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
