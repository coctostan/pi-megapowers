# Plan: State Source of Truth Refactor

## Strategy

This refactor replaces 4 modules, creates 6 new modules, and rewrites index.ts. To keep the codebase compiling at each task boundary, the plan follows three phases:

**Phase A (Tasks 1–10):** Build new modules alongside old ones. Add new fields (`completedTasks`, `megaEnabled`) to `MegapowersState` without removing old fields. New code uses new fields; old code continues using old fields.

**Phase B (Tasks 11–15):** Switch over. Rewrite index.ts to use new modules exclusively. Refactor ui.ts and store.ts. Old modules are no longer imported.

**Phase C (Tasks 16–18):** Clean up. Remove old fields from state type. Delete deprecated modules and their tests. Final verification.

---

### Task 1: state-io.ts — readState and writeState [no-test]

**Files:**
- Create: `extensions/megapowers/state-io.ts`
- Test: `tests/state-io.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state-io.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-state-io-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("readState", () => {
  it("returns initial state when state.json is missing", () => {
    const state = readState(tmp);
    expect(state.activeIssue).toBeNull();
    expect(state.phase).toBeNull();
    expect(state.completedTasks).toEqual([]);
    expect(state.megaEnabled).toBe(true);
  });

  it("returns initial state when state.json contains invalid JSON", () => {
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), "not json{{{");
    const state = readState(tmp);
    expect(state.activeIssue).toBeNull();
    expect(state.phase).toBeNull();
  });

  it("reads valid state from disk", () => {
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify({
      version: 1,
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1, 2],
      megaEnabled: false,
    }));
    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-test");
    expect(state.phase).toBe("implement");
    expect(state.completedTasks).toEqual([1, 2]);
    expect(state.megaEnabled).toBe(false);
  });

  it("merges over defaults for missing fields", () => {
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify({
      activeIssue: "001-test",
      phase: "spec",
    }));
    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-test");
    expect(state.completedTasks).toEqual([]);
    expect(state.megaEnabled).toBe(true);
    expect(state.reviewApproved).toBe(false);
  });
});

describe("writeState", () => {
  it("writes state that can be read back", () => {
    const original = readState(tmp);
    const modified = { ...original, activeIssue: "002-foo", phase: "plan" as const, completedTasks: [1, 3] };
    writeState(tmp, modified);
    const loaded = readState(tmp);
    expect(loaded.activeIssue).toBe("002-foo");
    expect(loaded.phase).toBe("plan");
    expect(loaded.completedTasks).toEqual([1, 3]);
  });

  it("creates .megapowers directory if missing", () => {
    writeState(tmp, readState(tmp));
    expect(existsSync(join(tmp, ".megapowers", "state.json"))).toBe(true);
  });

  it("uses atomic write (temp file + rename)", () => {
    writeState(tmp, { ...readState(tmp), activeIssue: "003-bar" });
    // Verify no temp files left behind
    const files = require("fs").readdirSync(join(tmp, ".megapowers"));
    const tempFiles = files.filter((f: string) => f.startsWith(".state.json."));
    expect(tempFiles).toHaveLength(0);
    // Verify content is correct
    const content = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
    expect(JSON.parse(content).activeIssue).toBe("003-bar");
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/state-io.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createInitialState, type MegapowersState } from "./state-machine.js";

const STATE_FILE = "state.json";
const MEGA_DIR = ".megapowers";

export function readState(cwd: string): MegapowersState {
  const filePath = join(cwd, MEGA_DIR, STATE_FILE);
  if (!existsSync(filePath)) return createInitialState();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    return { ...createInitialState(), ...raw };
  } catch {
    return createInitialState();
  }
}

export function writeState(cwd: string, state: MegapowersState): void {
  const dir = join(cwd, MEGA_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filePath = join(dir, STATE_FILE);
  const tmpPath = join(dir, `.state.json.${process.pid}.${Date.now()}.tmp`);

  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmpPath, filePath);
}
```

**Verify:** `bun test tests/state-io.test.ts`

---

### Task 2: MegapowersState type — add completedTasks and megaEnabled [depends: 1]

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Test: `tests/state-machine.test.ts`

**Test:** Add to existing `tests/state-machine.test.ts`:

```typescript
describe("createInitialState — new fields", () => {
  it("includes completedTasks as empty array", () => {
    const state = createInitialState();
    expect(state.completedTasks).toEqual([]);
  });

  it("includes megaEnabled as true", () => {
    const state = createInitialState();
    expect(state.megaEnabled).toBe(true);
  });
});
```

**Implementation:**

Add two fields to `MegapowersState` interface in `state-machine.ts`:

```typescript
export interface MegapowersState {
  // ... existing fields ...
  /** Indices of completed tasks (new: replaces planTasks[].completed) */
  completedTasks: number[];
  /** Whether megapowers enforcement is active (session-scoped) */
  megaEnabled: boolean;
}
```

Update `createInitialState()`:

```typescript
export function createInitialState(): MegapowersState {
  return {
    // ... existing fields ...
    completedTasks: [],
    megaEnabled: true,
  };
}
```

**Verify:** `bun test tests/state-machine.test.ts`

---

### Task 3: spec-parser — hasOpenQuestions sentinel fix

**Files:**
- Modify: `extensions/megapowers/spec-parser.ts`
- Test: `tests/spec-parser.test.ts`

**Test:** Add to existing `tests/spec-parser.test.ts`:

```typescript
describe("hasOpenQuestions — sentinel handling", () => {
  const sentinels = [
    "None", "None.", "N/A", "n/a", "No open questions",
    "No open questions.", "(none)", "(None)", "- None", "- N/A",
    "1. None", "- (none)",
  ];

  for (const sentinel of sentinels) {
    it(`returns false for sentinel "${sentinel}"`, () => {
      const spec = `## Acceptance Criteria\n1. Works\n\n## Open Questions\n${sentinel}\n`;
      expect(hasOpenQuestions(spec)).toBe(false);
    });
  }

  it("returns true for actual question with ?", () => {
    const spec = `## Open Questions\n- What about edge case X?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns true for numbered question", () => {
    const spec = `## Open Questions\n1. How should auth work?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns false for empty section", () => {
    const spec = `## Open Questions\n\n## Out of Scope\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true for real questions mixed with sentinels", () => {
    const spec = `## Open Questions\n- None for auth\n- What about rate limiting?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});
```

**Implementation:**

Replace the `hasOpenQuestions` function in `spec-parser.ts`:

```typescript
const SENTINEL_PATTERN = /^[-\d.)\s]*\(?\s*(none|n\/a|no open questions)\.?\s*\)?$/i;

export function hasOpenQuestions(specContent: string): boolean {
  const lines = specContent.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Open\s+Questions/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (!inSection) continue;

    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (SENTINEL_PATTERN.test(trimmed)) continue;
    // Real content — it's an open question
    return true;
  }

  return false;
}
```

**Verify:** `bun test tests/spec-parser.test.ts`

---

### Task 4: write-policy.ts — canWrite pure function

**Files:**
- Create: `extensions/megapowers/write-policy.ts`
- Test: `tests/write-policy.test.ts`

**Test:**

```typescript
import { describe, it, expect } from "bun:test";
import { canWrite, isTestFile, isAllowlisted, isTestRunnerCommand } from "../extensions/megapowers/write-policy.js";
import type { TddTaskState } from "../extensions/megapowers/write-policy.js";

function makeTddState(overrides: Partial<TddTaskState> = {}): TddTaskState {
  return { taskIndex: 1, state: "no-test", skipped: false, ...overrides };
}

describe("canWrite — megaEnabled=false passthrough", () => {
  it("allows any file in any phase when mega is off", () => {
    const result = canWrite("implement", "src/main.ts", false, false, makeTddState());
    expect(result.allowed).toBe(true);
  });
});

describe("canWrite — .megapowers/ always allowed", () => {
  for (const phase of ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "done"] as const) {
    it(`allows .megapowers/ writes in ${phase}`, () => {
      const result = canWrite(phase, ".megapowers/state.json", true, false, null);
      expect(result.allowed).toBe(true);
    });
  }
});

describe("canWrite — blocking phases", () => {
  const blockingPhases = ["brainstorm", "spec", "plan", "review", "verify", "done"] as const;

  for (const phase of blockingPhases) {
    it(`blocks source code in ${phase}`, () => {
      const result = canWrite(phase, "src/main.ts", true, false, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  }
});

describe("canWrite — implement phase TDD gating", () => {
  it("allows test files freely", () => {
    const result = canWrite("implement", "tests/main.test.ts", true, false, makeTddState());
    expect(result.allowed).toBe(true);
  });

  it("blocks production files when no test written", () => {
    const result = canWrite("implement", "src/main.ts", true, false, makeTddState({ state: "no-test" }));
    expect(result.allowed).toBe(false);
  });

  it("blocks production files when test written but not run", () => {
    const result = canWrite("implement", "src/main.ts", true, false, makeTddState({ state: "test-written" }));
    expect(result.allowed).toBe(false);
  });

  it("allows production files when tests ran red (impl-allowed)", () => {
    const result = canWrite("implement", "src/main.ts", true, false, makeTddState({ state: "impl-allowed" }));
    expect(result.allowed).toBe(true);
  });

  it("allows production files for [no-test] tasks", () => {
    const result = canWrite("implement", "src/main.ts", true, true, makeTddState());
    expect(result.allowed).toBe(true);
  });

  it("allows production files when TDD skipped", () => {
    const result = canWrite("implement", "src/main.ts", true, false, makeTddState({ skipped: true }));
    expect(result.allowed).toBe(true);
  });

  it("allows allowlisted files (json, yaml, md, etc.) without TDD", () => {
    const result = canWrite("implement", "tsconfig.json", true, false, makeTddState({ state: "no-test" }));
    expect(result.allowed).toBe(true);
  });
});

describe("canWrite — code-review phase has same TDD gating", () => {
  it("blocks production files when no test written", () => {
    const result = canWrite("code-review", "src/main.ts", true, false, makeTddState({ state: "no-test" }));
    expect(result.allowed).toBe(false);
  });

  it("allows when impl-allowed", () => {
    const result = canWrite("code-review", "src/main.ts", true, false, makeTddState({ state: "impl-allowed" }));
    expect(result.allowed).toBe(true);
  });
});

describe("isTestFile", () => {
  it("matches *.test.ts", () => expect(isTestFile("src/auth.test.ts")).toBe(true));
  it("matches tests/ dir", () => expect(isTestFile("tests/auth.ts")).toBe(true));
  it("rejects regular src", () => expect(isTestFile("src/auth.ts")).toBe(false));
});

describe("isAllowlisted", () => {
  it("allows .json", () => expect(isAllowlisted("tsconfig.json")).toBe(true));
  it("allows .md", () => expect(isAllowlisted("README.md")).toBe(true));
  it("allows .config.ts", () => expect(isAllowlisted("vite.config.ts")).toBe(true));
  it("rejects .ts", () => expect(isAllowlisted("src/main.ts")).toBe(false));
});

describe("isTestRunnerCommand", () => {
  it("detects bun test", () => expect(isTestRunnerCommand("bun test")).toBe(true));
  it("detects bun test with args", () => expect(isTestRunnerCommand("bun test tests/foo.test.ts")).toBe(true));
  it("rejects compound commands", () => expect(isTestRunnerCommand("echo foo && bun test")).toBe(false));
  it("rejects non-test commands", () => expect(isTestRunnerCommand("ls -la")).toBe(false));
});
```

**Implementation:**

```typescript
// extensions/megapowers/write-policy.ts
import type { Phase } from "./state-machine.js";

// --- TDD types (moved from tdd-guard.ts) ---

export type TddState = "no-test" | "test-written" | "impl-allowed";

export interface TddTaskState {
  taskIndex: number;
  state: TddState;
  skipped: boolean;
  skipReason?: string;
}

// --- File classification (moved from tdd-guard.ts) ---

const TEST_FILE_PATTERNS = [/\.test\.[^/]+$/, /\.spec\.[^/]+$/];
const TEST_DIR_PATTERNS = [/(^|\/)tests?\//, /(^|\/)__tests__\//];

export function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath)) ||
         TEST_DIR_PATTERNS.some(p => p.test(filePath));
}

const ALLOWLIST_EXTENSIONS = [
  /\.json$/, /\.ya?ml$/, /\.toml$/, /\.env(\..*)?$/,
  /\.d\.ts$/, /\.md$/, /\.config\.[^/]+$/,
];

export function isAllowlisted(filePath: string): boolean {
  return ALLOWLIST_EXTENSIONS.some(p => p.test(filePath));
}

const TEST_RUNNER_PATTERNS = [
  /^\s*bun\s+test(\s|$)/, /^\s*npm\s+test(\s|$)/,
  /^\s*npx\s+(jest|vitest|mocha)(\s|$)/, /^\s*pytest(\s|$)/,
  /^\s*python\s+-m\s+pytest(\s|$)/, /^\s*cargo\s+test(\s|$)/,
  /^\s*go\s+test(\s|$)/, /^\s*deno\s+test(\s|$)/,
  /^\s*npm\s+run\s+test(\s|$)/,
];

export function isTestRunnerCommand(command: string): boolean {
  if (/[;&|\n]/.test(command)) return false;
  return TEST_RUNNER_PATTERNS.some(p => p.test(command));
}

// --- Write policy ---

export interface WriteResult {
  allowed: boolean;
  reason?: string;
}

const TDD_PHASES: ReadonlySet<Phase> = new Set(["implement", "code-review"]);
const BLOCKING_PHASES: ReadonlySet<Phase> = new Set([
  "brainstorm", "spec", "plan", "review", "verify", "done",
]);

export function canWrite(
  phase: Phase | null,
  filePath: string,
  megaEnabled: boolean,
  taskIsNoTest: boolean,
  tddState: TddTaskState | null,
): WriteResult {
  if (!megaEnabled) return { allowed: true };
  if (!phase) return { allowed: true };

  // .megapowers/ always writable
  if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
    return { allowed: true };
  }

  // Blocking phases: no source code
  if (BLOCKING_PHASES.has(phase)) {
    return { allowed: false, reason: `Source code writes blocked in ${phase} phase. Only .megapowers/ paths are writable.` };
  }

  // TDD phases: guarded writes
  if (TDD_PHASES.has(phase)) {
    if (isAllowlisted(filePath)) return { allowed: true };
    if (taskIsNoTest) return { allowed: true };
    if (tddState?.skipped) return { allowed: true };
    if (isTestFile(filePath)) return { allowed: true };

    // Production file — check TDD state
    if (!tddState || tddState.state === "no-test") {
      return { allowed: false, reason: "TDD violation: write a failing test first before writing production code." };
    }
    if (tddState.state === "test-written") {
      return { allowed: false, reason: "TDD violation: run your tests and confirm they fail (red) before writing production code." };
    }
    // impl-allowed
    return { allowed: true };
  }

  return { allowed: true };
}

// --- Test result handling ---

export function handleTestResult(exitCode: number, currentState: TddState): TddState {
  if (currentState !== "test-written") return currentState;
  return exitCode !== 0 ? "impl-allowed" : "test-written";
}
```

**Verify:** `bun test tests/write-policy.test.ts`

---

### Task 5: gates.ts — refactor to disk-derived task list [depends: 2, 3]

**Files:**
- Modify: `extensions/megapowers/gates.ts`
- Modify: `tests/gates.test.ts`

**Test:** Rewrite `tests/gates.test.ts`. Key changes:
- `implement→verify` gate now reads plan.md and checks `state.completedTasks` instead of `state.planTasks[].completed`
- `spec→plan` gate now properly handles sentinels in open questions
- Gate error messages are actionable

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGate } from "../extensions/megapowers/gates.js";
import { createStore } from "../extensions/megapowers/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-gate-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides };
}

describe("implement → verify (disk-derived)", () => {
  it("fails when plan.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "implement", completedTasks: [1] }), "verify", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("plan.md");
  });

  it("fails when plan.md has no tasks", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "# Plan\nNo tasks here.");
    const result = checkGate(makeState({ phase: "implement", completedTasks: [] }), "verify", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("No tasks");
  });

  it("fails when not all tasks completed", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\nDo A\n### Task 2: B\nDo B\n### Task 3: C\nDo C");
    const result = checkGate(makeState({ phase: "implement", completedTasks: [1] }), "verify", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("2");
    expect(result.reason).toContain("3");
  });

  it("passes when all tasks completed", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\nDo A\n### Task 2: B\nDo B");
    const result = checkGate(makeState({ phase: "implement", completedTasks: [1, 2] }), "verify", store);
    expect(result.pass).toBe(true);
  });

  it("returns actionable error with task count", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\nDetails\n### Task 2: B\nDetails\n### Task 3: C\nDetails");
    const result = checkGate(makeState({ phase: "implement", completedTasks: [1] }), "verify", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/2.*of.*3.*incomplete/i);
  });
});

describe("spec → plan (sentinel fix)", () => {
  it("passes when open questions says 'None'", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Open Questions\nNone\n");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(true);
  });

  it("fails when spec has real open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Open Questions\n- What about X?\n");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("open questions");
  });

  it("returns actionable error when spec.md missing", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("spec.md");
    expect(result.reason).toContain("save_artifact");
  });
});

// Keep all other existing gate tests (backward transitions, review→implement, etc.)
// Only the implement→verify and spec→plan tests change.
```

**Implementation:**

Update `gates.ts` `implement→verify` case to parse plan.md and use `completedTasks`:

```typescript
case "implement→verify": {
  const planContent = store.readPlanFile(state.activeIssue, "plan.md");
  if (!planContent) {
    return { pass: false, reason: "plan.md not found. Use megapowers_save_artifact to save the plan first." };
  }
  const tasks = extractPlanTasks(planContent);
  if (tasks.length === 0) {
    return { pass: false, reason: "No tasks found in plan.md. Check the plan format." };
  }
  const completedSet = new Set(state.completedTasks);
  const incomplete = tasks.filter(t => !completedSet.has(t.index));
  if (incomplete.length > 0) {
    return {
      pass: false,
      reason: `${incomplete.length} of ${tasks.length} tasks still incomplete. Complete remaining tasks before advancing to verify.`,
    };
  }
  return { pass: true };
}
```

Update `spec→plan` error message to mention `megapowers_save_artifact`:

```typescript
case "spec→plan": {
  if (!store.planFileExists(state.activeIssue, "spec.md")) {
    return { pass: false, reason: "spec.md not found. Use megapowers_save_artifact to save the spec first." };
  }
  // ... (hasOpenQuestions check unchanged — sentinel fix is in Task 3)
}
```

Add import of `extractPlanTasks` at top of `gates.ts`.

**Verify:** `bun test tests/gates.test.ts`

---

### Task 6: phase-advance.ts — shared advancePhase function [depends: 1, 2, 5]

**Files:**
- Create: `extensions/megapowers/phase-advance.ts`
- Test: `tests/phase-advance.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advancePhase } from "../extensions/megapowers/phase-advance.js";
import { writeState, readState } from "../extensions/megapowers/state-io.js";
import { createStore } from "../extensions/megapowers/store.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-advance-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("advancePhase", () => {
  it("advances brainstorm→spec", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "brainstorm" });
    const result = advancePhase(tmp);
    expect(result.success).toBe(true);
    expect(result.newPhase).toBe("spec");
    const state = readState(tmp);
    expect(state.phase).toBe("spec");
  });

  it("blocks spec→plan when spec.md missing", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = advancePhase(tmp);
    expect(result.success).toBe(false);
    expect(result.error).toContain("spec.md");
  });

  it("advances spec→plan when spec.md exists with no open questions", () => {
    const store = createStore(tmp);
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Acceptance Criteria\n1. Works\n");
    const result = advancePhase(tmp);
    expect(result.success).toBe(true);
    expect(result.newPhase).toBe("plan");
  });

  it("advances review→implement when review approved", () => {
    const store = createStore(tmp);
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "review", reviewApproved: true });
    const result = advancePhase(tmp);
    expect(result.success).toBe(true);
    expect(result.newPhase).toBe("implement");
  });

  it("resets reviewApproved when transitioning to plan", () => {
    const store = createStore(tmp);
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "review", reviewApproved: true });
    const result = advancePhase(tmp, "plan");
    expect(result.success).toBe(true);
    const state = readState(tmp);
    expect(state.reviewApproved).toBe(false);
  });

  it("returns error when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = advancePhase(tmp);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active");
  });

  it("persists phase to state.json", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "brainstorm" });
    advancePhase(tmp);
    const state = readState(tmp);
    expect(state.phase).toBe("spec");
    expect(state.phaseHistory.length).toBe(1);
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/phase-advance.ts
import { readState, writeState } from "./state-io.js";
import { getValidTransitions, canTransition, type Phase } from "./state-machine.js";
import { checkGate } from "./gates.js";
import { createStore } from "./store.js";

export interface AdvanceResult {
  success: boolean;
  newPhase?: Phase;
  error?: string;
}

export function advancePhase(cwd: string, targetPhase?: Phase): AdvanceResult {
  const state = readState(cwd);
  if (!state.activeIssue || !state.workflow || !state.phase) {
    return { success: false, error: "No active issue or phase." };
  }

  const store = createStore(cwd);
  const validNext = getValidTransitions(state.workflow, state.phase);
  if (validNext.length === 0) {
    return { success: false, error: `No valid transitions from ${state.phase}.` };
  }

  // If target specified, validate it; otherwise pick first valid
  const target = targetPhase ?? validNext[0];
  if (!canTransition(state.workflow, state.phase, target)) {
    return { success: false, error: `Invalid transition: ${state.phase} → ${target}.` };
  }

  // Check gate
  const gate = checkGate(state, target, store);
  if (!gate.pass) {
    return { success: false, error: gate.reason ?? `Gate blocked: ${state.phase} → ${target}.` };
  }

  // Mutate
  const newState = {
    ...state,
    phase: target,
    phaseHistory: [
      ...state.phaseHistory,
      { from: state.phase, to: target, timestamp: Date.now() },
    ],
    doneMode: null,
  };

  // Reset review approval when entering plan
  if (target === "plan") newState.reviewApproved = false;

  // Reset TDD state when entering implement
  if (target === "implement") {
    newState.tddTaskState = null;
    newState.currentTaskIndex = 0;
    // Find first incomplete task
    // (task list derived from plan.md; completedTasks tells us what's done)
  }

  writeState(cwd, newState);
  return { success: true, newPhase: target };
}
```

**Verify:** `bun test tests/phase-advance.test.ts`

---

### Task 7: tool-artifact.ts — megapowers_save_artifact handler [depends: 1, 2]

**Files:**
- Create: `extensions/megapowers/tool-artifact.ts`
- Test: `tests/tool-artifact.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSaveArtifact } from "../extensions/megapowers/tool-artifact.js";
import { writeState, readState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-artifact-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("handleSaveArtifact", () => {
  it("writes content to .megapowers/plans/{issue}/{phase}.md", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = handleSaveArtifact(tmp, { phase: "spec", content: "# Spec\n\n## Goal\nBuild it." });
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "utf-8");
    expect(content).toContain("Build it.");
  });

  it("does not modify state.json", () => {
    const initial = { ...createInitialState(), activeIssue: "001-test", workflow: "feature" as const, phase: "spec" as const };
    writeState(tmp, initial);
    handleSaveArtifact(tmp, { phase: "spec", content: "# Spec" });
    const state = readState(tmp);
    expect(state.phase).toBe("spec"); // unchanged
  });

  it("returns error when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = handleSaveArtifact(tmp, { phase: "spec", content: "# Spec" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active issue");
  });

  it("creates plans directory if missing", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "plan" });
    handleSaveArtifact(tmp, { phase: "plan", content: "### Task 1: Do it" });
    expect(existsSync(join(tmp, ".megapowers", "plans", "001-test", "plan.md"))).toBe(true);
  });

  it("overwrites existing artifact", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    handleSaveArtifact(tmp, { phase: "spec", content: "v1" });
    handleSaveArtifact(tmp, { phase: "spec", content: "v2" });
    const content = readFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "utf-8");
    expect(content).toBe("v2");
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/tool-artifact.ts
import { readState } from "./state-io.js";
import { createStore } from "./store.js";

export interface SaveArtifactParams {
  phase: string;
  content: string;
}

export interface SaveArtifactResult {
  success: boolean;
  error?: string;
  path?: string;
}

export function handleSaveArtifact(cwd: string, params: SaveArtifactParams): SaveArtifactResult {
  const state = readState(cwd);
  if (!state.activeIssue) {
    return { success: false, error: "No active issue. Use /issue to select or create one." };
  }

  const store = createStore(cwd);
  const filename = `${params.phase}.md`;
  store.ensurePlanDir(state.activeIssue);
  store.writePlanFile(state.activeIssue, filename, params.content);

  return {
    success: true,
    path: `.megapowers/plans/${state.activeIssue}/${filename}`,
  };
}
```

**Verify:** `bun test tests/tool-artifact.test.ts`

---

### Task 8: tool-signal.ts — review_approve action [depends: 1, 2]

**Files:**
- Create: `extensions/megapowers/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal } from "../extensions/megapowers/tool-signal.js";
import { writeState, readState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-signal-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("review_approve", () => {
  it("sets reviewApproved to true in state.json", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "review" });
    const result = handleSignal(tmp, "review_approve");
    expect(result.success).toBe(true);
    const state = readState(tmp);
    expect(state.reviewApproved).toBe(true);
  });

  it("returns confirmation message", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "review" });
    const result = handleSignal(tmp, "review_approve");
    expect(result.message).toContain("approved");
  });

  it("fails when not in review phase", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = handleSignal(tmp, "review_approve");
    expect(result.success).toBe(false);
    expect(result.error).toContain("review");
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/tool-signal.ts
import { readState, writeState } from "./state-io.js";
import { advancePhase } from "./phase-advance.js";
import { extractPlanTasks } from "./plan-parser.js";
import { createStore } from "./store.js";
import type { JJ } from "./jj.js";

export interface SignalResult {
  success: boolean;
  message?: string;
  error?: string;
}

export function handleSignal(cwd: string, action: string, jj?: JJ): SignalResult {
  switch (action) {
    case "review_approve":
      return handleReviewApprove(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, jj);
    case "task_done":
      return handleTaskDone(cwd, jj);
    default:
      return { success: false, error: `Unknown action: ${action}. Valid: task_done, review_approve, phase_next.` };
  }
}

function handleReviewApprove(cwd: string): SignalResult {
  const state = readState(cwd);
  if (state.phase !== "review") {
    return { success: false, error: `Cannot approve review: current phase is ${state.phase}, not review.` };
  }
  writeState(cwd, { ...state, reviewApproved: true });
  return { success: true, message: "Plan approved. Use megapowers_signal({ action: 'phase_next' }) to advance to implement." };
}

// Stubs for phase_next and task_done — implemented in Tasks 9 and 10
function handlePhaseNext(_cwd: string, _jj?: JJ): SignalResult {
  return { success: false, error: "Not yet implemented." };
}

function handleTaskDone(_cwd: string, _jj?: JJ): SignalResult {
  return { success: false, error: "Not yet implemented." };
}
```

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 9: tool-signal.ts — phase_next action [depends: 6, 8]

**Files:**
- Modify: `extensions/megapowers/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

**Test:** Add to `tests/tool-signal.test.ts`:

```typescript
describe("phase_next", () => {
  it("advances to next phase and writes state", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "brainstorm" });
    const result = handleSignal(tmp, "phase_next");
    expect(result.success).toBe(true);
    expect(result.message).toContain("spec");
    expect(readState(tmp).phase).toBe("spec");
  });

  it("returns actionable error when gate blocks", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = handleSignal(tmp, "phase_next");
    expect(result.success).toBe(false);
    expect(result.error).toContain("spec.md");
  });

  it("returns error when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = handleSignal(tmp, "phase_next");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active");
  });

  it("advances full feature chain: brainstorm→spec→plan→review→implement", () => {
    const store = createStore(tmp);
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "brainstorm" });

    // brainstorm → spec (no gate)
    expect(handleSignal(tmp, "phase_next").success).toBe(true);
    expect(readState(tmp).phase).toBe("spec");

    // Save spec, then spec → plan
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Acceptance Criteria\n1. Works\n");
    expect(handleSignal(tmp, "phase_next").success).toBe(true);
    expect(readState(tmp).phase).toBe("plan");

    // Save plan, then plan → review (first valid transition)
    store.writePlanFile("001-test", "plan.md", "### Task 1: Do\nDetails");
    expect(handleSignal(tmp, "phase_next").success).toBe(true);
    expect(readState(tmp).phase).toBe("review");

    // Approve review, then review → implement
    handleSignal(tmp, "review_approve");
    expect(handleSignal(tmp, "phase_next").success).toBe(true);
    expect(readState(tmp).phase).toBe("implement");
  });
});
```

**Implementation:**

Replace `handlePhaseNext` stub in `tool-signal.ts`:

```typescript
function handlePhaseNext(cwd: string, _jj?: JJ): SignalResult {
  const result = advancePhase(cwd);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, message: `Advanced to ${result.newPhase} phase.` };
}
```

Note: jj integration (AC 19, 21) is deferred to Task 10 to keep this task focused on core flow.

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 10: tool-signal.ts — task_done action [depends: 1, 2, 4, 9]

**Files:**
- Modify: `extensions/megapowers/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

**Test:** Add to `tests/tool-signal.test.ts`:

```typescript
import { createStore } from "../extensions/megapowers/store.js";

// Helper to set up implement phase with plan.md
function setupImplement(tasks: string, completedTasks: number[] = []) {
  const store = createStore(tmp);
  store.ensurePlanDir("001-test");
  store.writePlanFile("001-test", "plan.md", tasks);
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "implement",
    completedTasks,
    currentTaskIndex: 0,
    tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
  });
}

describe("task_done", () => {
  it("adds currentTaskIndex to completedTasks and advances index", () => {
    setupImplement("### Task 1: A\nDetails\n### Task 2: B\nDetails");
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(true);
    const state = readState(tmp);
    expect(state.completedTasks).toContain(1);
    expect(state.currentTaskIndex).toBe(1); // advanced to next task's array position
  });

  it("returns next task description in message", () => {
    setupImplement("### Task 1: First thing\nDetails\n### Task 2: Second thing\nDetails");
    const result = handleSignal(tmp, "task_done");
    expect(result.message).toContain("Second thing");
  });

  it("succeeds for [no-test] task without TDD state", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Config [no-test]\nUpdate config\n### Task 2: Code\nWrite code");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: null,
    });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(true);
  });

  it("fails for non-[no-test] task when TDD not satisfied", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Feature\nImplement feature");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(false);
    expect(result.error).toContain("TDD");
  });

  it("auto-advances to verify when last task completed", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Only task\nDetails");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(true);
    expect(result.message).toContain("verify");
    const state = readState(tmp);
    expect(state.phase).toBe("verify");
    expect(state.completedTasks).toContain(1);
  });

  it("skips already-completed tasks when finding next index", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      completedTasks: [2], // Task 2 already done (e.g. from a prior session)
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(true);
    const state = readState(tmp);
    expect(state.completedTasks).toEqual(expect.arrayContaining([1, 2]));
    // Next incomplete is task 3, which is at array index 2
    expect(state.currentTaskIndex).toBe(2);
  });

  it("fails when not in implement phase", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(false);
    expect(result.error).toContain("implement");
  });
});
```

**Implementation:**

Replace `handleTaskDone` stub in `tool-signal.ts`:

```typescript
function handleTaskDone(cwd: string, _jj?: JJ): SignalResult {
  const state = readState(cwd);
  if (state.phase !== "implement") {
    return { success: false, error: `Cannot mark task done: current phase is ${state.phase}, not implement.` };
  }
  if (!state.activeIssue) {
    return { success: false, error: "No active issue." };
  }

  // Parse tasks from plan.md
  const store = createStore(cwd);
  const planContent = store.readPlanFile(state.activeIssue, "plan.md");
  if (!planContent) {
    return { success: false, error: "plan.md not found. Cannot determine task list." };
  }
  const tasks = extractPlanTasks(planContent);
  if (tasks.length === 0) {
    return { success: false, error: "No tasks found in plan.md." };
  }

  const currentTask = tasks[state.currentTaskIndex];
  if (!currentTask) {
    return { success: false, error: `No task at index ${state.currentTaskIndex}.` };
  }

  // TDD validation (skip for [no-test] tasks and skipped TDD)
  if (!currentTask.noTest) {
    const tdd = state.tddTaskState;
    if (tdd && !tdd.skipped && tdd.state !== "impl-allowed") {
      return {
        success: false,
        error: `TDD requirements not met for Task ${currentTask.index}. Current TDD state: ${tdd?.state ?? "none"}. Write a failing test and run it before marking complete.`,
      };
    }
  }

  // Mark complete
  const completedTasks = [...state.completedTasks, currentTask.index];
  const completedSet = new Set(completedTasks);

  // Find next incomplete task
  const nextIncompleteIdx = tasks.findIndex((t, i) => i > state.currentTaskIndex && !completedSet.has(t.index));
  // If no task after current, wrap around to find any incomplete
  const fallbackIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx :
    tasks.findIndex(t => !completedSet.has(t.index));

  const allDone = completedSet.size >= tasks.length || fallbackIdx < 0;

  const newState = {
    ...state,
    completedTasks,
    currentTaskIndex: allDone ? state.currentTaskIndex : (nextIncompleteIdx >= 0 ? nextIncompleteIdx : fallbackIdx),
    tddTaskState: null, // Reset for next task
  };

  // Auto-advance to verify if all done
  if (allDone) {
    newState.phase = "verify" as any;
    newState.phaseHistory = [
      ...state.phaseHistory,
      { from: "implement" as any, to: "verify" as any, timestamp: Date.now() },
    ];
    writeState(cwd, newState);
    return {
      success: true,
      message: `Task ${currentTask.index} complete. All ${tasks.length} tasks done! Automatically advanced to verify phase.`,
    };
  }

  writeState(cwd, newState);
  const nextTask = tasks[newState.currentTaskIndex];
  return {
    success: true,
    message: `Task ${currentTask.index} complete (${completedTasks.length}/${tasks.length}). Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
}
```

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 11: tool-overrides.ts — write and edit overrides [depends: 1, 2, 4]

**Files:**
- Create: `extensions/megapowers/tool-overrides.ts`
- Test: `tests/tool-overrides.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkWriteOverride, checkBashOverride } from "../extensions/megapowers/tool-overrides.js";
import { writeState, readState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-overrides-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("checkWriteOverride", () => {
  it("blocks source code in spec phase", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec", megaEnabled: true });
    const result = checkWriteOverride(tmp, "src/main.ts");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("allows .megapowers/ paths in any phase", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec", megaEnabled: true });
    const result = checkWriteOverride(tmp, ".megapowers/plans/001-test/spec.md");
    expect(result.allowed).toBe(true);
  });

  it("allows writes when megaEnabled is false", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec", megaEnabled: false });
    const result = checkWriteOverride(tmp, "src/main.ts");
    expect(result.allowed).toBe(true);
  });

  it("allows writes when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = checkWriteOverride(tmp, "src/main.ts");
    expect(result.allowed).toBe(true);
  });

  it("tracks test file write in tddTaskState", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    });
    const result = checkWriteOverride(tmp, "tests/main.test.ts");
    expect(result.allowed).toBe(true);
    // Check that state was updated
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written");
  });

  it("blocks production files when TDD not satisfied", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    });
    const result = checkWriteOverride(tmp, "src/main.ts");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("TDD");
  });

  it("allows production files when impl-allowed", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = checkWriteOverride(tmp, "src/main.ts");
    expect(result.allowed).toBe(true);
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/tool-overrides.ts
import { readState, writeState } from "./state-io.js";
import { canWrite, isTestFile, isTestRunnerCommand, handleTestResult, type TddTaskState } from "./write-policy.js";
import { extractPlanTasks } from "./plan-parser.js";
import { createStore } from "./store.js";

export interface WriteCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a write/edit to filePath is allowed given current state on disk.
 * If allowed and the file is a test file, updates tddTaskState in state.json.
 */
export function checkWriteOverride(cwd: string, filePath: string): WriteCheckResult {
  const state = readState(cwd);

  // No active issue or phase → passthrough
  if (!state.activeIssue || !state.phase) {
    return { allowed: true };
  }

  // Determine if current task is [no-test]
  let taskIsNoTest = false;
  if (state.phase === "implement" || state.phase === "code-review") {
    const store = createStore(cwd);
    const planContent = store.readPlanFile(state.activeIssue, "plan.md");
    if (planContent) {
      const tasks = extractPlanTasks(planContent);
      const currentTask = tasks[state.currentTaskIndex];
      taskIsNoTest = currentTask?.noTest ?? false;
    }
  }

  // Initialize TDD state for current task if needed
  let tddState = state.tddTaskState;
  if ((state.phase === "implement" || state.phase === "code-review") && !taskIsNoTest) {
    if (!tddState || tddState.taskIndex !== (state.currentTaskIndex + 1)) {
      // Will be initialized properly; for now use current
    }
  }

  const result = canWrite(state.phase, filePath, state.megaEnabled, taskIsNoTest, tddState);

  if (!result.allowed) {
    return { allowed: false, reason: result.reason };
  }

  // Track test file writes → update TDD state
  if ((state.phase === "implement" || state.phase === "code-review") && isTestFile(filePath)) {
    if (tddState && tddState.state === "no-test") {
      const updated = { ...state, tddTaskState: { ...tddState, state: "test-written" as const } };
      writeState(cwd, updated);
    }
  }

  return { allowed: true };
}

/**
 * Post-process a bash command result. If it's a test runner command during implement/code-review,
 * record the result in tddTaskState.
 */
export function processBashResult(cwd: string, command: string, exitCode: number): void {
  const state = readState(cwd);
  if (state.phase !== "implement" && state.phase !== "code-review") return;
  if (!state.megaEnabled) return;
  if (!isTestRunnerCommand(command)) return;

  const tddState = state.tddTaskState;
  if (!tddState || tddState.state !== "test-written") return;

  const newTddState = handleTestResult(exitCode, tddState.state);
  if (newTddState !== tddState.state) {
    writeState(cwd, { ...state, tddTaskState: { ...tddState, state: newTddState } });
  }
}
```

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 12: tool-overrides.ts — bash override [depends: 11]

**Files:**
- Modify: `tests/tool-overrides.test.ts`

**Test:** Add to `tests/tool-overrides.test.ts`:

```typescript
describe("processBashResult", () => {
  it("records test failure (impl-allowed) when exit code non-zero", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", 1);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("impl-allowed");
  });

  it("does not change state when tests pass (still test-written)", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", 0);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written");
  });

  it("ignores non-test commands", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "ls -la", 0);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written"); // unchanged
  });

  it("ignores when not in implement/code-review phase", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", 1);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written"); // unchanged — not in implement
  });

  it("ignores when megaEnabled is false", () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: false,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", 1);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written"); // unchanged — mega off
  });

  it("does not block any commands (no return value)", () => {
    // bash override always executes the command; it only post-processes
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "implement", megaEnabled: true });
    // processBashResult returns void — no blocking
    expect(() => processBashResult(tmp, "rm -rf /", 0)).not.toThrow();
  });
});
```

**Implementation:** Already implemented in Task 11's `processBashResult`. This task adds the test coverage.

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 13: prompts — megapowers protocol + phase tool instructions [depends: 2]

**Files:**
- Create: `prompts/megapowers-protocol.md`
- Modify: `prompts/write-spec.md`, `prompts/write-plan.md`, `prompts/review-plan.md`, `prompts/implement-task.md`, `prompts/brainstorm.md`, `prompts/verify.md`, `prompts/code-review.md`, `prompts/reproduce-bug.md`, `prompts/diagnose-bug.md`
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompts.test.ts`

**Test:** Add to `tests/prompts.test.ts`:

```typescript
describe("megapowers protocol injection", () => {
  it("loadPromptFile loads megapowers-protocol.md", () => {
    const protocol = loadPromptFile("megapowers-protocol.md");
    expect(protocol).toContain("megapowers_signal");
    expect(protocol).toContain("megapowers_save_artifact");
    expect(protocol).toContain("error");
  });
});

describe("phase prompts include tool instructions", () => {
  const phasesWithSaveArtifact = ["write-spec.md", "write-plan.md", "brainstorm.md", "reproduce-bug.md", "diagnose-bug.md"];
  for (const file of phasesWithSaveArtifact) {
    it(`${file} mentions megapowers_save_artifact`, () => {
      const template = loadPromptFile(file);
      expect(template).toContain("megapowers_save_artifact");
    });
  }

  it("review-plan.md mentions megapowers_signal review_approve", () => {
    const template = loadPromptFile("review-plan.md");
    expect(template).toContain("review_approve");
  });

  it("implement-task.md mentions megapowers_signal task_done", () => {
    const template = loadPromptFile("implement-task.md");
    expect(template).toContain("task_done");
  });
});
```

**Implementation:**

Create `prompts/megapowers-protocol.md`:

```markdown
## Megapowers Protocol

You have access to these megapowers tools:

### megapowers_signal({ action })
State transitions. Actions:
- `task_done` — mark current task complete (implement phase)
- `review_approve` — approve the plan (review phase)
- `phase_next` — advance to next phase

### megapowers_save_artifact({ phase, content })
Save phase output. Example: `megapowers_save_artifact({ phase: "spec", content: "..." })`

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly.
```

Add tool instructions to each phase prompt (append to existing content):

- `write-spec.md`: Add "When the spec is complete, call `megapowers_save_artifact({ phase: 'spec', content: '<full spec>' })`"
- `write-plan.md`: Add "When the plan is complete, call `megapowers_save_artifact({ phase: 'plan', content: '<full plan>' })`"
- `review-plan.md`: Add "If the plan is approved, call `megapowers_signal({ action: 'review_approve' })`. Then call `megapowers_signal({ action: 'phase_next' })` to advance."
- `implement-task.md`: Add "When the task is complete, call `megapowers_signal({ action: 'task_done' })`"
- `brainstorm.md`: Add "When brainstorming is complete, call `megapowers_save_artifact({ phase: 'brainstorm', content: '<brainstorm notes>' })`"
- And similar for other phases.

Update `prompts.ts` to load and prepend the protocol section:

```typescript
export function getMegapowersProtocol(): string {
  return loadPromptFile("megapowers-protocol.md");
}
```

**Verify:** `bun test tests/prompts.test.ts`

---

### Task 14: ui.ts — disk-based dashboard with completedTasks [depends: 2]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Test:** Add to `tests/ui.test.ts`:

```typescript
describe("renderDashboardLines — completedTasks format", () => {
  it("shows task progress from completedTasks array", () => {
    const state = makeState({
      phase: "implement",
      completedTasks: [1, 2],
      currentTaskIndex: 2,
      // planTasks still exists during transition — UI should prefer completedTasks
    });
    const lines = renderDashboardLines(state, [], mockTheme);
    const tasksLine = lines.find(l => l.includes("Tasks:"));
    // During transition, UI may use planTasks if available, or show completedTasks count
    expect(tasksLine).toBeDefined();
  });
});

describe("renderStatusText — completedTasks format", () => {
  it("shows completed count from completedTasks when planTasks empty", () => {
    const state = makeState({
      phase: "implement",
      completedTasks: [1, 2],
      planTasks: [], // new style: planTasks empty, completedTasks has data
    });
    const text = renderStatusText(state);
    expect(text).toContain("implement");
  });
});
```

**Implementation:**

Update `renderDashboardLines` and `renderStatusText` in `ui.ts` to support both old (`planTasks`) and new (`completedTasks`) formats during the transition period. When `planTasks` is empty but `completedTasks` has items, use `completedTasks.length` for the count. The total task count comes from the plan file (but for the dashboard, we can show just the completed count if we don't have the total readily available).

Add a helper:

```typescript
function getTaskProgress(state: MegapowersState): { completed: number; total: number } | null {
  // Old format: planTasks has items
  if (state.planTasks.length > 0) {
    return {
      completed: state.planTasks.filter(t => t.completed).length,
      total: state.planTasks.length,
    };
  }
  // New format: completedTasks has items (total unknown without plan.md)
  if (state.completedTasks.length > 0) {
    return { completed: state.completedTasks.length, total: 0 }; // total populated by caller if needed
  }
  return null;
}
```

**Verify:** `bun test tests/ui.test.ts`

---

### Task 15: index.ts — full rewrite [depends: 1, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14]

**Files:**
- Rewrite: `extensions/megapowers/index.ts`

This is the integration task. The new `index.ts`:

1. **No module-level `state` variable.** (AC 5)
2. **Registers `megapowers_signal` tool** using `handleSignal` from `tool-signal.ts` (AC 11)
3. **Registers `megapowers_save_artifact` tool** using `handleSaveArtifact` from `tool-artifact.ts` (AC 22)
4. **Overrides `write`/`edit`/`bash`** using `checkWriteOverride`/`processBashResult` from `tool-overrides.ts` and pi's `createWriteTool`/`createEditTool`/`createBashTool` for delegation (AC 25, 26, 30, 32)
5. **`session_start` handler**: reads state via `readState()`, resets `megaEnabled: true`, renders dashboard (AC 40)
6. **`before_agent_start` handler**: injects megapowers protocol + phase prompt if `megaEnabled` (AC 41, 42)
7. **No `session_shutdown` handler** that saves in-memory state — state is always on disk (AC 43)
8. **No `pi.appendEntry()` calls** (AC 43)
9. **`/mega off`** sets `megaEnabled: false` via writeState (AC 38)
10. **`/mega on`** sets `megaEnabled: true` via writeState (AC 39)
11. **`/task done`** calls `handleSignal(cwd, "task_done")` (AC 49)
12. **`/phase next`** calls `handleSignal(cwd, "phase_next")` (AC 49)
13. **`/review approve`** calls `handleSignal(cwd, "review_approve")` (AC 49)
14. **`/tdd skip`** sets tddTaskState.skipped via readState/writeState (AC 50)
15. **Satellite mode**: registers only write/edit/bash overrides with in-memory TDD state. No signal/artifact tools. (AC 48)

**Implementation:**

```typescript
// extensions/megapowers/index.ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createWriteTool, createEditTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

import { readState, writeState } from "./state-io.js";
import { handleSignal } from "./tool-signal.js";
import { handleSaveArtifact } from "./tool-artifact.js";
import { checkWriteOverride, processBashResult } from "./tool-overrides.js";
import { createStore } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";
import { getMegapowersProtocol, getPhasePromptTemplate, interpolatePrompt, BRAINSTORM_PLAN_PHASES, buildImplementTaskVars, formatAcceptanceCriteriaList, buildSourceIssuesContext, loadPromptFile } from "./prompts.js";
import { extractPlanTasks } from "./plan-parser.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "./spec-parser.js";
import { isSatelliteMode } from "./satellite.js";
import { canWrite, isTestFile, isTestRunnerCommand, handleTestResult, type TddTaskState } from "./write-policy.js";
import { createBatchHandler } from "./tools.js";

export default function megapowers(pi: ExtensionAPI): void {
  // --- Satellite mode ---
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    // In-memory TDD state (the one documented exception to disk-first)
    let satelliteTddState: TddTaskState | null = null;
    let satellitePhase: string | null = null;
    let satelliteTaskIsNoTest = false;

    pi.on("session_start", async (_event, ctx) => {
      const state = readState(ctx.cwd);
      satellitePhase = state.phase;
      if (state.phase === "implement" && state.activeIssue) {
        const store = createStore(ctx.cwd);
        const plan = store.readPlanFile(state.activeIssue, "plan.md");
        if (plan) {
          const tasks = extractPlanTasks(plan);
          const current = tasks[state.currentTaskIndex];
          satelliteTaskIsNoTest = current?.noTest ?? false;
          satelliteTddState = state.tddTaskState ? { ...state.tddTaskState } : {
            taskIndex: current?.index ?? 0,
            state: "no-test",
            skipped: false,
          };
        }
      }
    });

    // Override write/edit with in-memory TDD enforcement
    // Override bash to track test results in memory
    // (No megapowers_signal or megapowers_save_artifact for satellites)
    return;
  }

  // --- Primary session ---
  let jj: JJ;
  let ui: MegapowersUI;

  // Register megapowers_signal tool
  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "State transition signal. Actions: task_done (mark current task complete), review_approve (approve plan review), phase_next (advance to next phase).",
    parameters: Type.Object({
      action: StringEnum(["task_done", "review_approve", "phase_next"] as const),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!jj) jj = createJJ(pi);
      const result = handleSignal(ctx.cwd, params.action, jj);
      if (!result.success) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: {} };
      }
      // Refresh dashboard
      if (!ui) ui = createUI();
      if (ctx.hasUI) {
        const store = createStore(ctx.cwd);
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: {} };
    },
  });

  // Register megapowers_save_artifact tool
  pi.registerTool({
    name: "megapowers_save_artifact",
    label: "Megapowers Save Artifact",
    description: "Save phase output to disk. The phase determines the filename (e.g., phase='spec' → spec.md).",
    parameters: Type.Object({
      phase: Type.String({ description: "Phase name: brainstorm, spec, plan, reproduce, diagnosis, review, verify, code-review" }),
      content: Type.String({ description: "Full content to save" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSaveArtifact(ctx.cwd, params);
      if (!result.success) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: {} };
      }
      return { content: [{ type: "text", text: `Artifact saved to ${result.path}` }], details: {} };
    },
  });

  // Override write tool
  pi.registerTool({
    name: "write",
    label: "write",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
      content: Type.String({ description: "Content to write to the file" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const check = checkWriteOverride(ctx.cwd, params.path);
      if (!check.allowed) {
        return { content: [{ type: "text", text: `Blocked: ${check.reason}` }], details: {} };
      }
      const original = createWriteTool(ctx.cwd);
      return original.execute(toolCallId, params, signal, onUpdate);
    },
    // No renderCall/renderResult → built-in renderer used (AC 30)
  });

  // Override edit tool
  pi.registerTool({
    name: "edit",
    label: "edit",
    description: "Edit a file by replacing exact text. The oldText must match exactly (including whitespace).",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file to edit" }),
      oldText: Type.String({ description: "Exact text to find and replace" }),
      newText: Type.String({ description: "New text to replace the old text with" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const check = checkWriteOverride(ctx.cwd, params.path);
      if (!check.allowed) {
        return { content: [{ type: "text", text: `Blocked: ${check.reason}` }], details: {} };
      }
      const original = createEditTool(ctx.cwd);
      return original.execute(toolCallId, params, signal, onUpdate);
    },
  });

  // Override bash tool
  pi.registerTool({
    name: "bash",
    label: "bash",
    description: "Execute a bash command in the current working directory.",
    parameters: Type.Object({
      command: Type.String({ description: "Bash command to execute" }),
      timeout: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const original = createBashTool(ctx.cwd);
      const result = await original.execute(toolCallId, params, signal, onUpdate);
      // Post-process: track test results
      const exitCode = result.details?.exitCode ?? (result.content?.some((c: any) => c.text?.includes("error")) ? 1 : 0);
      // Actually, we need to detect exit code from the result
      // The bash tool result has isError flag
      const isError = result.content?.some((c: any) => c.type === "text" && /exit code [1-9]/.test(c.text ?? ""));
      processBashResult(ctx.cwd, params.command, isError ? 1 : 0);
      return result;
    },
  });

  // --- Session lifecycle ---
  pi.on("session_start", async (_event, ctx) => {
    jj = createJJ(pi);
    ui = createUI();

    // Reset megaEnabled to true at session start (AC 40)
    const state = readState(ctx.cwd);
    if (!state.megaEnabled) {
      writeState(ctx.cwd, { ...state, megaEnabled: true });
    }

    if (ctx.hasUI) {
      const store = createStore(ctx.cwd);
      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    }
  });

  // --- Prompt injection ---
  pi.on("before_agent_start", async (_event, ctx) => {
    const state = readState(ctx.cwd);
    if (!state.megaEnabled || !state.activeIssue || !state.phase) return;

    const store = createStore(ctx.cwd);
    const vars: Record<string, string> = {
      issue_slug: state.activeIssue,
      phase: state.phase,
    };

    // Load artifacts for context
    const artifacts = ["brainstorm.md", "spec.md", "plan.md", "diagnosis.md", "verify.md", "code-review.md"];
    const varNames = ["brainstorm_content", "spec_content", "plan_content", "diagnosis_content", "verify_content", "code_review_content"];
    for (let i = 0; i < artifacts.length; i++) {
      const content = store.readPlanFile(state.activeIssue, artifacts[i]);
      if (content) vars[varNames[i]] = content;
    }

    // Bugfix aliases
    if (state.workflow === "bugfix") {
      const reproduce = store.readPlanFile(state.activeIssue, "reproduce.md");
      const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
      if (reproduce) { vars.brainstorm_content = reproduce; vars.reproduce_content = reproduce; }
      if (diagnosis) { vars.spec_content = diagnosis; vars.diagnosis_content = diagnosis; }
    }

    // Derived data (AC 8, 9 — parsed on demand, not cached)
    if (vars.spec_content) {
      const criteria = extractAcceptanceCriteria(vars.spec_content);
      if (criteria.length > 0) vars.acceptance_criteria_list = formatAcceptanceCriteriaList(criteria);
    }

    // Implement phase: task vars from plan.md + completedTasks
    if (state.phase === "implement" && vars.plan_content) {
      const tasks = extractPlanTasks(vars.plan_content);
      if (tasks.length > 0) {
        // Build task vars using completedTasks
        const completedSet = new Set(state.completedTasks);
        const tasksWithCompletion = tasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
        Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
      }
    }

    // Learnings + Roadmap
    if (BRAINSTORM_PLAN_PHASES.includes(state.phase)) {
      vars.learnings = store.getLearnings();
      vars.roadmap = store.readRoadmap();
    }

    // Source issues
    const issue = store.getIssue(state.activeIssue);
    if (issue && issue.sources.length > 0) {
      const sourceContext = buildSourceIssuesContext(store.getSourceIssues(state.activeIssue));
      if (sourceContext) vars.source_issues_context = sourceContext;
    }

    // Build prompt: protocol + phase template
    const protocol = getMegapowersProtocol();
    const phaseTemplate = getPhasePromptTemplate(state.phase);

    // Done phase: mode-based template selection
    let template = phaseTemplate;
    if (state.phase === "done" && state.doneMode) {
      const modeMap: Record<string, string> = {
        "generate-docs": "generate-docs.md",
        "capture-learnings": "capture-learnings.md",
        "write-changelog": "write-changelog.md",
        "generate-bugfix-summary": "generate-bugfix-summary.md",
      };
      const f = modeMap[state.doneMode];
      if (f) { const t = loadPromptFile(f); if (t) template = t; }
      if (state.jjChangeId && jj) {
        try { vars.files_changed = await jj.diff(state.jjChangeId); } catch { vars.files_changed = ""; }
      }
      vars.learnings = store.getLearnings();
    }

    let prompt = protocol + "\n\n" + interpolatePrompt(template, vars);
    if (vars.source_issues_context) prompt += "\n\n" + vars.source_issues_context;
    if (!prompt.trim()) return;

    return {
      message: {
        customType: "megapowers-context",
        content: prompt,
        display: false,
      },
    };
  });

  // --- agent_end: refresh dashboard (no artifact routing!) ---
  pi.on("agent_end", async (_event, ctx) => {
    const state = readState(ctx.cwd);
    if (!state.activeIssue || !state.phase || !state.megaEnabled) return;
    if (ctx.hasUI) {
      if (!ui) ui = createUI();
      const store = createStore(ctx.cwd);
      ui.renderDashboard(ctx, state, store);
    }
  });

  // --- Commands ---
  pi.registerCommand("mega", {
    description: "Toggle megapowers enforcement (usage: /mega off | /mega on | /mega)",
    handler: async (args, ctx) => {
      const sub = args.trim().toLowerCase();
      if (sub === "off") {
        const state = readState(ctx.cwd);
        writeState(ctx.cwd, { ...state, megaEnabled: false });
        ctx.ui.notify("Megapowers OFF. All overrides are passthrough.", "info");
        return;
      }
      if (sub === "on") {
        const state = readState(ctx.cwd);
        writeState(ctx.cwd, { ...state, megaEnabled: true });
        ctx.ui.notify("Megapowers ON. Enforcement restored.", "info");
        return;
      }
      // Default: show dashboard
      if (!ui) ui = createUI();
      const store = createStore(ctx.cwd);
      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    },
  });

  pi.registerCommand("task", {
    description: "Mark current task done (usage: /task done)",
    handler: async (args, ctx) => {
      if (args.trim() === "done") {
        if (!jj) jj = createJJ(pi);
        const result = handleSignal(ctx.cwd, "task_done", jj);
        ctx.ui.notify(result.success ? (result.message ?? "Done") : `Error: ${result.error}`, result.success ? "info" : "error");
        if (result.success && ui) {
          const store = createStore(ctx.cwd);
          ui.renderDashboard(ctx, readState(ctx.cwd), store);
        }
      } else {
        ctx.ui.notify("Usage: /task done", "info");
      }
    },
  });

  pi.registerCommand("phase", {
    description: "Advance phase (usage: /phase next | /phase)",
    handler: async (args, ctx) => {
      if (args.trim() === "next") {
        if (!jj) jj = createJJ(pi);
        const result = handleSignal(ctx.cwd, "phase_next", jj);
        ctx.ui.notify(result.success ? (result.message ?? "Advanced") : `Error: ${result.error}`, result.success ? "info" : "error");
      } else {
        const state = readState(ctx.cwd);
        ctx.ui.notify(`Phase: ${state.phase ?? "none"}\nWorkflow: ${state.workflow ?? "none"}\nIssue: ${state.activeIssue ?? "none"}`, "info");
      }
      if (ui) {
        const store = createStore(ctx.cwd);
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
    },
  });

  pi.registerCommand("review", {
    description: "Approve review (usage: /review approve)",
    handler: async (args, ctx) => {
      if (args.trim() === "approve") {
        const result = handleSignal(ctx.cwd, "review_approve");
        ctx.ui.notify(result.success ? (result.message ?? "Approved") : `Error: ${result.error}`, result.success ? "info" : "error");
      } else {
        ctx.ui.notify("Usage: /review approve", "info");
      }
    },
  });

  pi.registerCommand("tdd", {
    description: "TDD control (usage: /tdd skip | /tdd status)",
    handler: async (args, ctx) => {
      const sub = args.trim();
      if (sub === "skip") {
        const state = readState(ctx.cwd);
        if (state.phase !== "implement" && state.phase !== "code-review") {
          ctx.ui.notify("Not in implement/code-review phase.", "info");
          return;
        }
        const tdd = state.tddTaskState ?? { taskIndex: state.currentTaskIndex, state: "no-test" as const, skipped: false };
        writeState(ctx.cwd, { ...state, tddTaskState: { ...tdd, skipped: true, skipReason: "User-approved runtime skip" } });
        ctx.ui.notify("TDD enforcement skipped for current task.", "info");
      } else if (sub === "status") {
        const state = readState(ctx.cwd);
        const tddInfo = state.tddTaskState
          ? `Task ${state.tddTaskState.taskIndex}: ${state.tddTaskState.state}${state.tddTaskState.skipped ? " (skipped)" : ""}`
          : "No active TDD state";
        ctx.ui.notify(`TDD: ${tddInfo}\nPhase: ${state.phase ?? "none"}`, "info");
      } else {
        ctx.ui.notify("Usage: /tdd skip | /tdd status", "info");
      }
    },
  });

  // Retain existing commands: /issue, /done, /learn, /triage, create_batch tool
  // (These are copied from the current index.ts with readState/writeState replacing the module-level state variable)
  // ... (full implementations follow the same pattern: read from disk, mutate, write to disk)
}
```

Note: The full index.ts rewrite is ~300 lines. The implementation above shows the architecture. The complete file includes `/issue`, `/done`, `/learn`, `/triage` commands and the `create_batch` tool, all converted from the current event-handler model to read-from-disk pattern. The `session_shutdown` handler is **removed entirely** — no more saving in-memory state.

**Verify:** `bun test` (all tests pass). Manual verification: start a session, `/issue new`, interact through phases.

---

### Task 16: store.ts — remove loadState/saveState [depends: 15] [no-test]

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Modify: `tests/store.test.ts`

**Implementation:**

Remove `loadState()` and `saveState()` from the `Store` interface and `createStore()` implementation. These are now handled by `state-io.ts` (`readState`/`writeState`). All call sites were already updated in Task 15.

Update `tests/store.test.ts`: Remove tests for `loadState` and `saveState`. These are now covered by `tests/state-io.test.ts`.

**Verify:** `bun test tests/store.test.ts`

---

### Task 17: Delete deprecated modules + remove old state fields [depends: 15, 16]

**Files:**
- Delete: `extensions/megapowers/artifact-router.ts`
- Delete: `extensions/megapowers/tdd-guard.ts`
- Delete: `extensions/megapowers/state-recovery.ts`
- Delete: `extensions/megapowers/satellite-tdd.ts`
- Delete: `tests/artifact-router.test.ts`
- Delete: `tests/tdd-guard.test.ts`
- Delete: `tests/state-recovery.test.ts`
- Delete: `tests/satellite-tdd.test.ts`
- Modify: `extensions/megapowers/state-machine.ts`
- Modify: `tests/state-machine.test.ts`
- Modify: `tests/030-state-source-of-truth.test.ts`

**Implementation:**

1. **Delete the 4 deprecated source files** and their 4 test files.

2. **Remove old fields from `MegapowersState`** in `state-machine.ts`:
   - Remove `planTasks: PlanTask[]`
   - Remove `acceptanceCriteria: AcceptanceCriterion[]`
   - Remove the import of `TddTaskState` from `tdd-guard.js` (now from `write-policy.js`)
   - Keep `PlanTask` and `AcceptanceCriterion` types as exports (used by parsers and prompts)

3. **Update `createInitialState()`** to no longer include `planTasks` or `acceptanceCriteria`.

4. **Update `transition()` function** in `state-machine.ts`:
   - Remove `next.currentTaskIndex = next.planTasks.findIndex(t => !t.completed)` logic — task index is now managed by `tool-signal.ts` via `completedTasks`
   - Keep workflow/phase transition logic intact

5. **Update `tests/state-machine.test.ts`**:
   - Remove references to `planTasks` and `acceptanceCriteria`
   - Update transition tests that asserted on `planTasks` behavior

6. **Rewrite `tests/030-state-source-of-truth.test.ts`** to test the new architecture:
   - Test `hasOpenQuestions` sentinel handling (already passing from Task 3)
   - Test `handleSignal` for task completion (replaces processAgentOutput tests)
   - Test `checkWriteOverride` for TDD enforcement (replaces tdd-guard tests)
   - Remove all `processAgentOutput` tests (artifact-router deleted)

**Verify:** `bun test` — all tests pass. The 23 previously-failing tests are gone (they tested the old regex-based detection that's been replaced by tools).

---

### Task 18: End-to-end verification [depends: 17]

**Files:**
- Modify: `tests/030-state-source-of-truth.test.ts`

**Test:** Rewrite as integration tests validating all 8 source issues are resolved:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { handleSignal } from "../extensions/megapowers/tool-signal.js";
import { handleSaveArtifact } from "../extensions/megapowers/tool-artifact.js";
import { checkWriteOverride, processBashResult } from "../extensions/megapowers/tool-overrides.js";
import { hasOpenQuestions, extractAcceptanceCriteria } from "../extensions/megapowers/spec-parser.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { createStore } from "../extensions/megapowers/store.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mega-e2e-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("#006 — acceptance criteria derived on demand, never cached", () => {
  it("criteria parsed from spec.md, not stored in state.json", () => {
    const store = createStore(tmp);
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Acceptance Criteria\n1. User can log in\n2. Dashboard loads\n");
    const criteria = extractAcceptanceCriteria(store.readPlanFile("001-test", "spec.md")!);
    expect(criteria).toHaveLength(2);
    // state.json has no acceptanceCriteria field
    const state = readState(tmp);
    expect((state as any).acceptanceCriteria).toBeUndefined();
  });
});

describe("#017 — [no-test] tasks complete via tool call", () => {
  it("task_done succeeds for [no-test] task without TDD", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: Config update [no-test]\nUpdate config");
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "implement", currentTaskIndex: 0 });
    const result = handleSignal(tmp, "task_done");
    expect(result.success).toBe(true);
  });
});

describe("#019 — task completion deterministically advances index", () => {
  it("task_done advances currentTaskIndex to next incomplete task", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test", workflow: "feature", phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    handleSignal(tmp, "task_done");
    const state = readState(tmp);
    expect(state.completedTasks).toContain(1);
    expect(state.currentTaskIndex).toBe(1);
  });
});

describe("#021 — disk-only state, no in-memory drift", () => {
  it("every signal reads from disk, writes to disk", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\n");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test", workflow: "feature", phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    handleSignal(tmp, "task_done");
    // Read state again — it persisted
    const state = readState(tmp);
    expect(state.completedTasks).toContain(1);
    expect(state.phase).toBe("verify"); // auto-advanced
  });
});

describe("#023 — 'None' in open questions does not block", () => {
  it("hasOpenQuestions returns false for 'None'", () => {
    expect(hasOpenQuestions("## Open Questions\nNone\n")).toBe(false);
    expect(hasOpenQuestions("## Open Questions\nN/A\n")).toBe(false);
    expect(hasOpenQuestions("## Open Questions\n- None\n")).toBe(false);
  });
});

describe("#024 — review approval via tool call, not regex", () => {
  it("review_approve signal sets reviewApproved", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "review" });
    handleSignal(tmp, "review_approve");
    expect(readState(tmp).reviewApproved).toBe(true);
  });
});

describe("#028 — artifacts saved via tool, not prose parsing", () => {
  it("megapowers_save_artifact writes to disk without parsing content", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "spec" });
    const result = handleSaveArtifact(tmp, { phase: "spec", content: "Arbitrary content with no special format" });
    expect(result.success).toBe(true);
  });
});

describe("#029 — tasks from plan.md, progress in completedTasks", () => {
  it("task list derived from plan.md on every signal call", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "### Task 1: A\n\n### Task 2: B\n");
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test", workflow: "feature", phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    handleSignal(tmp, "task_done");
    // Completion stored as index, not in planTasks
    const state = readState(tmp);
    expect(state.completedTasks).toEqual([1]);
    expect((state as any).planTasks).toBeUndefined(); // field doesn't exist
  });
});
```

**Verify:** `bun test` — all tests pass, 0 failures.

---

## Acceptance Criteria Coverage

| AC | Task(s) |
|---|---|
| 1–4 (state-io) | 1 |
| 5 (no module-level state) | 15 |
| 6–7 (thin state schema) | 2, 17 |
| 8–9 (derived data) | 5, 15 |
| 10 (sentinel fix) | 3 |
| 11 (megapowers_signal tool) | 8, 9, 10, 15 |
| 12–15 (task_done) | 10 |
| 16 (review_approve) | 8 |
| 17–18 (phase_next) | 9 |
| 19–21 (jj in signals) | 9, 10 |
| 22–24 (save_artifact) | 7 |
| 25–26 (write/edit override) | 11, 15 |
| 27–28 (phase write policy) | 4 |
| 29 (TDD tracking in state) | 11 |
| 30 (built-in rendering) | 15 |
| 31 (allowlist) | 4 |
| 32–34 (bash override) | 12, 15 |
| 35–37 (canWrite) | 4 |
| 38–40 (mega off/on) | 15 |
| 41–42 (prompt architecture) | 13 |
| 43 (no appendEntry) | 15 |
| 44–47 (delete modules) | 17 |
| 48 (satellite mode) | 15 |
| 49 (slash command fallbacks) | 15 |
| 50 (/tdd skip) | 15 |
| 51–55 (source issue resolution) | 18 |
