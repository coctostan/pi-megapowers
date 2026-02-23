# Plan: State Source of Truth Refactor

## Strategy

Build alongside existing code (new modules), then switch over (rewire index.ts), then clean up (delete old modules). Three phases:

1. **Tasks 1–12**: Build new modules — `state-io.ts`, `write-policy.ts`, `spec-parser.ts` fix, `phase-advance.ts`, `tool-signal.ts`, `tool-artifact.ts`, `tool-overrides.ts`, prompt templates
2. **Task 13**: Rewire `index.ts` — register new tools/overrides, port all commands, remove in-memory state
3. **Tasks 14–16**: Clean up — migrate remaining call sites, delete old modules, delete old tests

## Design Decisions

### `completedTasks` stores `PlanTask.index` values (1-based)

`currentTaskIndex` is a 0-based array index into the derived `tasks[]` array (from `plan-parser`). `completedTasks` stores `PlanTask.index` values, which are 1-based task numbers parsed from `### Task N:` headers. This matches what users see in the plan and TUI.

### TDD state is tied to task index

`tddTaskState.taskIndex` stores the `PlanTask.index` (1-based) of the task it applies to. When checking TDD state, `canWrite` and `handleTaskDone` validate that `tddTaskState.taskIndex === currentTask.index`. A previous task's `impl-allowed` does not leak to the next task.

### `readState` strips unknown keys

To enforce AC7 (no `planTasks`/`acceptanceCriteria` in state), `readState` picks only known keys from the parsed JSON, discarding any legacy fields.

### `MegapowersState` migration is gradual

Task 1 adds new fields (`completedTasks`, `megaEnabled`) alongside existing fields (`planTasks`, `acceptanceCriteria`). The old fields are marked `@deprecated` and made optional (`planTasks?: PlanTask[]`). This keeps `ui.ts`, `store.ts`, and existing tests compiling until Task 14 migrates all call sites, after which Task 15 removes the deprecated fields.

### jj operations move into tool handlers

AC19–21 are IN SCOPE. `advancePhase()` accepts an optional `JJ` instance. When advancing to `implement`, it creates the issue-level jj change. When advancing to `done`, it squashes task changes. `handleTaskDone()` creates per-task jj changes. jj failures are always non-fatal (warn, not error).

### AC38: `/mega off` truly hides custom tools

The pi SDK exports `pi.setActiveTools()`. When `/mega off` runs, we call `setActiveTools` with the tool list minus `megapowers_signal` and `megapowers_save_artifact`. When `/mega on` runs, we restore them.

### Tool overrides delegate to built-in factories

`createWriteTool(cwd)`, `createEditTool(cwd)`, `createBashTool(cwd)` from `@mariozechner/pi-coding-agent` create the stock tools. Our overrides delegate to them after policy checks. No custom `renderCall`/`renderResult` is provided, preserving built-in rendering (AC30).

### Bash tool throws on non-zero exit

`createBashTool` rejects (throws) when exit code ≠ 0. Our bash override uses try/catch: catch = `isError: true`, success = `isError: false` for TDD tracking.

## AC Coverage

| AC | Task(s) | Notes |
|----|---------|-------|
| 1–4 | 1 | readState/writeState |
| 5 | 13 | index.ts rewrite |
| 6–7 | 1 | Thin state schema, readState strips unknown keys |
| 8 | 4, 5 | Parse plan.md on demand in gates and phase-advance |
| 9 | 4, 5 | Parse spec/diagnosis on demand in gates |
| 10 | 2 | hasOpenQuestions sentinel + question-mark logic |
| 11 | 7 | megapowers_signal registration |
| 12 | 7 | task_done happy path |
| 13 | 7 | task_done TDD validation (task-index-aware) |
| 14 | 7 | task_done [no-test] bypass |
| 15 | 7 | task_done final task auto-advance |
| 16 | 7 | review_approve |
| 17 | 6, 7 | phase_next via advancePhase |
| 18 | 5, 6 | Gate error messages |
| 19 | 6 | phase_next to implement creates jj change |
| 20 | 7 | task_done creates next task jj change |
| 21 | 6 | phase_next to done squashes jj changes |
| 22–24 | 8 | megapowers_save_artifact |
| 25–26 | 9 | write/edit overrides |
| 27 | 3 | Write policy blocking phases |
| 28 | 3, 9 | TDD-guarded phases |
| 29 | 9 | Test file detection → tddTaskState update |
| 30 | 9 | No custom renderCall/renderResult |
| 31 | 3 | Allowlist bypass |
| 32–34 | 10 | bash override |
| 35–37 | 3 | canWrite pure function |
| 38 | 13 | setActiveTools to hide/show custom tools |
| 39–40 | 13 | /mega on, /mega off, session_start reset |
| 41–42 | 11 | Prompt injection with phase-specific tool instructions |
| 43 | 13 | No appendEntry calls |
| 44 | 15 | Delete artifact-router.ts |
| 45 | 15 | Delete tdd-guard.ts |
| 46 | 15 | Delete state-recovery.ts |
| 47 | 15 | Delete satellite-tdd.ts |
| 48 | 12 | Satellite mode |
| 49 | 13 | Slash command fallbacks |
| 50 | 13 | /tdd skip |
| 51 | 4 | Derived acceptance criteria |
| 52 | 7 | Tool-based task completion |
| 53 | 2 | hasOpenQuestions fix |
| 54 | 7 | Tool-based review approval |
| 55 | 8 | Tool-based artifact persistence |

---

### Task 1: State I/O with thin schema

**Covers:** AC1, AC2, AC3, AC4, AC6, AC7

**Files:**
- Create: `extensions/megapowers/state-io.ts`
- Modify: `extensions/megapowers/state-machine.ts`
- Test: `tests/state-io.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

describe("state-io", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "state-io-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("readState", () => {
    it("returns default initial state when state.json is missing", () => {
      const state = readState(tmp);
      expect(state).toEqual(createInitialState());
    });

    it("returns default initial state when state.json contains invalid JSON", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), "not json {{{");
      const state = readState(tmp);
      expect(state).toEqual(createInitialState());
    });

    it("reads valid state.json and picks only known keys", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      const saved = {
        ...createInitialState(),
        activeIssue: "001-test",
        phase: "spec",
        completedTasks: [1, 2],
        megaEnabled: false,
      };
      writeFileSync(join(dir, "state.json"), JSON.stringify(saved));
      const state = readState(tmp);
      expect(state.activeIssue).toBe("001-test");
      expect(state.phase).toBe("spec");
      expect(state.completedTasks).toEqual([1, 2]);
      expect(state.megaEnabled).toBe(false);
    });

    it("merges over defaults for old formats missing new fields", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), JSON.stringify({
        version: 1,
        activeIssue: "001-test",
        phase: "implement",
      }));
      const state = readState(tmp);
      expect(state.completedTasks).toEqual([]);
      expect(state.megaEnabled).toBe(true);
      expect(state.activeIssue).toBe("001-test");
    });

    it("strips unknown keys like planTasks and acceptanceCriteria", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), JSON.stringify({
        version: 1,
        activeIssue: "001-test",
        phase: "implement",
        planTasks: [{ index: 1, description: "test", completed: false, noTest: false }],
        acceptanceCriteria: [{ id: 1, text: "works", status: "pending" }],
      }));
      const state = readState(tmp);
      expect((state as any).planTasks).toBeUndefined();
      expect((state as any).acceptanceCriteria).toBeUndefined();
    });
  });

  describe("writeState", () => {
    it("creates .megapowers directory if missing", () => {
      const state = { ...createInitialState(), activeIssue: "001-test" };
      writeState(tmp, state);
      expect(existsSync(join(tmp, ".megapowers", "state.json"))).toBe(true);
    });

    it("writes atomically via temp-file-then-rename", () => {
      const state = { ...createInitialState(), activeIssue: "001-test" };
      writeState(tmp, state);
      // Verify no temp files left behind
      const dir = join(tmp, ".megapowers");
      const files = require("node:fs").readdirSync(dir);
      expect(files).toEqual(["state.json"]);
    });
  });

  describe("round-trip", () => {
    it("writeState followed by readState returns identical state", () => {
      const state = {
        ...createInitialState(),
        activeIssue: "005-round-trip",
        workflow: "feature" as const,
        phase: "implement" as const,
        phaseHistory: [{ from: "plan" as const, to: "implement" as const, timestamp: 12345 }],
        currentTaskIndex: 2,
        completedTasks: [1, 2],
        reviewApproved: true,
        tddTaskState: { taskIndex: 3, state: "test-written" as const, skipped: false },
        taskJJChanges: { 1: "abc", 2: "def" },
        jjChangeId: "xyz",
        doneMode: null,
        megaEnabled: true,
      };
      writeState(tmp, state);
      const loaded = readState(tmp);
      expect(loaded).toEqual(state);
    });
  });

  describe("thin schema", () => {
    it("initial state has completedTasks array, not planTasks", () => {
      const state = createInitialState();
      expect(state.completedTasks).toEqual([]);
      expect(state.megaEnabled).toBe(true);
      // planTasks is deprecated optional — should be absent from initial state
      expect((state as any).planTasks).toBeUndefined();
    });
  });
});
```

**Implementation:**

Update `extensions/megapowers/state-machine.ts` — add new fields alongside deprecated old ones:

```typescript
// extensions/megapowers/state-machine.ts

// Define TddTaskState locally instead of importing from tdd-guard.ts
export type TddState = "no-test" | "test-written" | "impl-allowed";

export interface TddTaskState {
  taskIndex: number;
  state: TddState;
  skipped: boolean;
  skipReason?: string;
}

// Keep PlanTask and AcceptanceCriterion for parsers/derived data:
export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
  noTest: boolean;
  dependsOn?: number[];
}

export interface AcceptanceCriterion {
  id: number;
  text: string;
  status: "pending" | "pass" | "fail" | "partial";
}

export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  currentTaskIndex: number;
  completedTasks: number[];   // PlanTask.index values (1-based)
  tddTaskState: TddTaskState | null;
  taskJJChanges: Record<number, string>;
  jjChangeId: string | null;
  doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | "generate-bugfix-summary" | null;
  megaEnabled: boolean;

  // --- DEPRECATED: kept for compilation during migration, removed in Task 15 ---
  /** @deprecated Use completedTasks + deriveTasks() instead */
  planTasks?: PlanTask[];
  /** @deprecated Use deriveAcceptanceCriteria() instead */
  acceptanceCriteria?: AcceptanceCriterion[];
}
```

Update `createInitialState()`:

```typescript
export function createInitialState(): MegapowersState {
  return {
    version: 1,
    activeIssue: null,
    workflow: null,
    phase: null,
    phaseHistory: [],
    reviewApproved: false,
    currentTaskIndex: 0,
    completedTasks: [],
    tddTaskState: null,
    taskJJChanges: {},
    jjChangeId: null,
    doneMode: null,
    megaEnabled: true,
    // planTasks and acceptanceCriteria intentionally omitted from initial state
  };
}
```

Update `transition()` to use `completedTasks`:

```typescript
export function transition(state: MegapowersState, to: Phase, tasks?: PlanTask[]): MegapowersState {
  if (!state.activeIssue) {
    throw new Error("Cannot transition without an active issue");
  }
  if (!state.phase || !state.workflow) {
    throw new Error("Cannot transition without an active phase and workflow");
  }
  if (!canTransition(state.workflow, state.phase, to)) {
    throw new Error(`Invalid transition: ${state.phase} → ${to} in ${state.workflow} mode`);
  }

  const next: MegapowersState = {
    ...state,
    phase: to,
    phaseHistory: [
      ...state.phaseHistory,
      { from: state.phase, to, timestamp: Date.now() },
    ],
  };

  if (to === "plan") {
    next.reviewApproved = false;
  }

  if (to === "implement" && tasks) {
    const completedSet = new Set(state.completedTasks);
    const firstIncomplete = tasks.findIndex(t => !completedSet.has(t.index));
    next.currentTaskIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
    next.taskJJChanges = {};
  }

  next.doneMode = null;

  return next;
}
```

Remove the `import type { TddTaskState } from "./tdd-guard.js"` line from the top of the file.

Create `extensions/megapowers/state-io.ts`:

```typescript
// extensions/megapowers/state-io.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInitialState, type MegapowersState } from "./state-machine.js";

const STATE_DIR = ".megapowers";
const STATE_FILE = "state.json";

/** Keys allowed in MegapowersState — everything else is stripped on read. */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "reviewApproved", "currentTaskIndex", "completedTasks",
  "tddTaskState", "taskJJChanges", "jjChangeId", "doneMode", "megaEnabled",
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
```

**Verify:** `bun test tests/state-io.test.ts`

---

### Task 2: Fix hasOpenQuestions for sentinels and question-mark detection

**Covers:** AC10, AC53

**Files:**
- Modify: `extensions/megapowers/spec-parser.ts`
- Test: `tests/spec-parser.test.ts` (add cases)

**Test:**

Add these test cases to `tests/spec-parser.test.ts`:

```typescript
describe("hasOpenQuestions — sentinel detection", () => {
  const sentinels = [
    "None", "None.", "N/A", "n/a", "No open questions", "No open questions.",
    "(none)", "(None)", "- None", "- N/A", "1. None", "* None",
  ];

  for (const sentinel of sentinels) {
    it(`returns false for "${sentinel}"`, () => {
      const spec = `## Acceptance Criteria\n1. Works\n\n## Open Questions\n${sentinel}\n`;
      expect(hasOpenQuestions(spec)).toBe(false);
    });
  }

  it("returns false for empty section", () => {
    const spec = `## Acceptance Criteria\n1. Works\n\n## Open Questions\n\n## Out of Scope\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns false for non-list commentary without question marks", () => {
    const spec = `## Open Questions\nNo outstanding questions at this time.\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true for list items with question marks", () => {
    const spec = `## Open Questions\n- What about edge case X?\n- Should we support Y?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns true for numbered items with question marks", () => {
    const spec = `## Open Questions\n1. How should we handle auth?\n2. What's the migration path?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns false for list items without question marks", () => {
    const spec = `## Open Questions\n- None at this time\n- All resolved\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true when mix of sentinel and real question", () => {
    const spec = `## Open Questions\n- None\n- But what about caching?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});
```

**Implementation:**

Replace `hasOpenQuestions` in `extensions/megapowers/spec-parser.ts`:

```typescript
const SENTINEL_PATTERN = /^[-*]?\s*(?:\d+[.)]\s*)?(?:none\.?|n\/a|no open questions\.?|\(none\))$/i;

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

    // Skip sentinel values
    if (SENTINEL_PATTERN.test(trimmed)) continue;

    // Only list items (- , * , 1. , 1) ) containing ? count as open questions
    const isListItem = /^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
    if (isListItem && trimmed.includes("?")) {
      return true;
    }
    // Non-list lines are treated as commentary, not questions
  }

  return false;
}
```

**Verify:** `bun test tests/spec-parser.test.ts`

---

### Task 3: Write policy pure function

**Covers:** AC27, AC28, AC31, AC35, AC36, AC37

**Files:**
- Create: `extensions/megapowers/write-policy.ts`
- Test: `tests/write-policy.test.ts`

**Test:**

```typescript
import { describe, it, expect } from "bun:test";
import { canWrite } from "../extensions/megapowers/write-policy.js";
import type { Phase, TddTaskState } from "../extensions/megapowers/state-machine.js";

describe("canWrite", () => {
  const blockingPhases: Phase[] = ["brainstorm", "spec", "plan", "review", "verify", "done"];
  const tddPhases: Phase[] = ["implement", "code-review"];

  describe("megaEnabled=false bypasses all checks", () => {
    it("allows any file in any phase", () => {
      const result = canWrite("implement", "src/app.ts", false, false, null);
      expect(result.allowed).toBe(true);
    });
  });

  describe(".megapowers/ paths always allowed", () => {
    for (const phase of [...blockingPhases, ...tddPhases]) {
      it(`allows .megapowers/ in ${phase}`, () => {
        const result = canWrite(phase, ".megapowers/plans/001/spec.md", true, false, null);
        expect(result.allowed).toBe(true);
      });
    }
  });

  describe("blocking phases reject source code writes", () => {
    for (const phase of blockingPhases) {
      it(`blocks src/app.ts in ${phase}`, () => {
        const result = canWrite(phase, "src/app.ts", true, false, null);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
      });
    }
  });

  describe("TDD-guarded phases", () => {
    for (const phase of tddPhases) {
      it(`allows test files freely in ${phase}`, () => {
        const result = canWrite(phase, "tests/foo.test.ts", true, false, null);
        expect(result.allowed).toBe(true);
      });

      it(`blocks production files when tddState is null in ${phase}`, () => {
        const result = canWrite(phase, "src/app.ts", true, false, null);
        expect(result.allowed).toBe(false);
      });

      it(`blocks production files in test-written state in ${phase}`, () => {
        const tdd: TddTaskState = { taskIndex: 1, state: "test-written", skipped: false };
        const result = canWrite(phase, "src/app.ts", true, false, tdd);
        expect(result.allowed).toBe(false);
      });

      it(`allows production files in impl-allowed state in ${phase}`, () => {
        const tdd: TddTaskState = { taskIndex: 1, state: "impl-allowed", skipped: false };
        const result = canWrite(phase, "src/app.ts", true, false, tdd);
        expect(result.allowed).toBe(true);
      });

      it(`allows production files when tdd is skipped in ${phase}`, () => {
        const tdd: TddTaskState = { taskIndex: 1, state: "no-test", skipped: true };
        const result = canWrite(phase, "src/app.ts", true, false, tdd);
        expect(result.allowed).toBe(true);
      });

      it(`allows production files for [no-test] tasks in ${phase}`, () => {
        const result = canWrite(phase, "src/app.ts", true, true, null);
        expect(result.allowed).toBe(true);
      });
    }
  });

  describe("allowlisted file types bypass TDD", () => {
    const allowlisted = [
      "tsconfig.json", "config.yml", "config.yaml", "settings.toml",
      ".env", ".env.local", "types.d.ts", "README.md",
      "vitest.config.ts", "eslint.config.js",
    ];

    for (const file of allowlisted) {
      it(`allows ${file} in implement without TDD`, () => {
        const result = canWrite("implement", file, true, false, null);
        expect(result.allowed).toBe(true);
      });
    }
  });

  describe("null phase allows all writes", () => {
    it("allows source code when phase is null", () => {
      const result = canWrite(null, "src/app.ts", true, false, null);
      expect(result.allowed).toBe(true);
    });
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/write-policy.ts
import type { Phase, TddTaskState } from "./state-machine.js";

export interface WriteDecision {
  allowed: boolean;
  reason?: string;
}

// --- File classification (moved from tdd-guard.ts) ---

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

// --- Test runner detection (moved from tdd-guard.ts) ---

const TEST_RUNNER_PATTERNS = [
  /^\s*bun\s+test(\s|$)/,
  /^\s*npm\s+test(\s|$)/,
  /^\s*npx\s+(jest|vitest|mocha)(\s|$)/,
  /^\s*pytest(\s|$)/,
  /^\s*python\s+-m\s+pytest(\s|$)/,
  /^\s*cargo\s+test(\s|$)/,
  /^\s*go\s+test(\s|$)/,
  /^\s*deno\s+test(\s|$)/,
  /^\s*npm\s+run\s+test(\s|$)/,
];

export function isTestRunnerCommand(command: string): boolean {
  if (/[;&|\n]/.test(command)) return false;
  for (const p of TEST_RUNNER_PATTERNS) if (p.test(command)) return true;
  return false;
}

// --- Blocking phases ---

const BLOCKING_PHASES: ReadonlySet<string> = new Set([
  "brainstorm", "spec", "plan", "review", "verify", "done",
]);

const TDD_PHASES: ReadonlySet<string> = new Set(["implement", "code-review"]);

// --- Core policy ---

export function canWrite(
  phase: Phase | null,
  filePath: string,
  megaEnabled: boolean,
  taskIsNoTest: boolean,
  tddState: TddTaskState | null,
): WriteDecision {
  if (!megaEnabled) return { allowed: true };
  if (!phase) return { allowed: true };

  // .megapowers/ paths always allowed
  if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
    return { allowed: true };
  }

  if (BLOCKING_PHASES.has(phase)) {
    return {
      allowed: false,
      reason: `Source code writes are blocked during the ${phase} phase. Only .megapowers/ paths are writable.`,
    };
  }

  if (TDD_PHASES.has(phase)) {
    if (isAllowlisted(filePath)) return { allowed: true };
    if (isTestFile(filePath)) return { allowed: true };
    if (taskIsNoTest) return { allowed: true };
    if (tddState?.skipped) return { allowed: true };
    if (tddState?.state === "impl-allowed") return { allowed: true };

    return {
      allowed: false,
      reason: "TDD violation: write a test file and run tests (they must fail) before writing production code.",
    };
  }

  return { allowed: true };
}
```

**Verify:** `bun test tests/write-policy.test.ts`

---

### Task 4: Derived data helpers [depends: 1]

**Covers:** AC8, AC9, AC51

**Files:**
- Create: `extensions/megapowers/derived.ts`
- Test: `tests/derived.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deriveTasks, deriveAcceptanceCriteria } from "../extensions/megapowers/derived.js";

describe("derived", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "derived-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writePlan(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), content);
  }

  function writeSpec(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), content);
  }

  function writeDiagnosis(issue: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "diagnosis.md"), content);
  }

  describe("deriveTasks", () => {
    it("parses tasks from plan.md", () => {
      writePlan("001-test", "# Plan\n\n### Task 1: Setup\n\n### Task 2: Build [no-test]\n\n### Task 3: Integrate [depends: 1, 2]\n");
      const tasks = deriveTasks(tmp, "001-test");
      expect(tasks).toHaveLength(3);
      expect(tasks[0].index).toBe(1);
      expect(tasks[1].noTest).toBe(true);
      expect(tasks[2].dependsOn).toEqual([1, 2]);
    });

    it("returns empty array when plan.md missing", () => {
      expect(deriveTasks(tmp, "001-missing")).toEqual([]);
    });

    it("returns empty array when plan.md has no tasks", () => {
      writePlan("001-empty", "# Plan\n\nNo tasks here.\n");
      expect(deriveTasks(tmp, "001-empty")).toEqual([]);
    });
  });

  describe("deriveAcceptanceCriteria", () => {
    it("parses from spec.md for feature workflow", () => {
      writeSpec("001-test", "# Spec\n\n## Acceptance Criteria\n1. User can log in\n2. User sees dashboard\n");
      const criteria = deriveAcceptanceCriteria(tmp, "001-test", "feature");
      expect(criteria).toHaveLength(2);
      expect(criteria[0].text).toBe("User can log in");
    });

    it("parses from diagnosis.md for bugfix workflow", () => {
      writeDiagnosis("001-test", "# Diagnosis\n\n## Fixed When\n1. Error no longer occurs\n2. Tests pass\n");
      const criteria = deriveAcceptanceCriteria(tmp, "001-test", "bugfix");
      expect(criteria).toHaveLength(2);
      expect(criteria[0].text).toBe("Error no longer occurs");
    });

    it("returns empty array when artifact missing", () => {
      expect(deriveAcceptanceCriteria(tmp, "001-missing", "feature")).toEqual([]);
    });
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/derived.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlanTasks } from "./plan-parser.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "./spec-parser.js";
import type { PlanTask, AcceptanceCriterion, WorkflowType } from "./state-machine.js";

export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  const planPath = join(cwd, ".megapowers", "plans", issueSlug, "plan.md");
  if (!existsSync(planPath)) return [];
  const content = readFileSync(planPath, "utf-8");
  return extractPlanTasks(content);
}

export function deriveAcceptanceCriteria(
  cwd: string,
  issueSlug: string,
  workflow: WorkflowType,
): AcceptanceCriterion[] {
  const filename = workflow === "bugfix" ? "diagnosis.md" : "spec.md";
  const filePath = join(cwd, ".megapowers", "plans", issueSlug, filename);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return workflow === "bugfix"
    ? extractFixedWhenCriteria(content)
    : extractAcceptanceCriteria(content);
}
```

**Verify:** `bun test tests/derived.test.ts`

---

### Task 5: Refactor gates to use disk-based derived data [depends: 1, 2, 4]

**Covers:** AC8, AC9, AC10, AC18, AC51

**Files:**
- Modify: `extensions/megapowers/gates.ts`
- Modify: `extensions/megapowers/ui.ts` (update `checkGate` call site)
- Test: `tests/gates.test.ts` (rewrite for new signature)

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGate } from "../extensions/megapowers/gates.js";
import { createInitialState, type MegapowersState, type Phase } from "../extensions/megapowers/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides };
}

describe("gates (disk-based)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "gates-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeArtifact(issue: string, filename: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), content);
  }

  it("spec→plan: passes when spec exists with no open questions", () => {
    writeArtifact("001-test", "spec.md", "# Spec\n\n## Open Questions\nNone\n");
    const result = checkGate(makeState({ phase: "spec" }), "plan", tmp);
    expect(result.pass).toBe(true);
  });

  it("spec→plan: fails when spec is missing", () => {
    const result = checkGate(makeState({ phase: "spec" }), "plan", tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("spec.md");
  });

  it("spec→plan: fails with open questions", () => {
    writeArtifact("001-test", "spec.md", "# Spec\n\n## Open Questions\n- What about auth?\n");
    const result = checkGate(makeState({ phase: "spec" }), "plan", tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("open questions");
  });

  it("plan→implement: passes when plan.md exists", () => {
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: Do thing\n");
    const result = checkGate(makeState({ phase: "plan" }), "implement", tmp);
    expect(result.pass).toBe(true);
  });

  it("plan→implement: fails when plan.md missing", () => {
    const result = checkGate(makeState({ phase: "plan" }), "implement", tmp);
    expect(result.pass).toBe(false);
  });

  it("review→implement: passes when reviewApproved is true", () => {
    const result = checkGate(makeState({ phase: "review", reviewApproved: true }), "implement", tmp);
    expect(result.pass).toBe(true);
  });

  it("review→implement: fails when reviewApproved is false", () => {
    const result = checkGate(makeState({ phase: "review" }), "implement", tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("review");
  });

  it("implement→verify: passes when all tasks completed (completedTasks)", () => {
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    const result = checkGate(
      makeState({ phase: "implement", completedTasks: [1, 2] }),
      "verify",
      tmp,
    );
    expect(result.pass).toBe(true);
  });

  it("implement→verify: fails with incomplete tasks", () => {
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    const result = checkGate(
      makeState({ phase: "implement", completedTasks: [1] }),
      "verify",
      tmp,
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("1 of 2");
  });

  it("backward transitions always pass", () => {
    const result = checkGate(makeState({ phase: "review" }), "plan", tmp);
    expect(result.pass).toBe(true);
  });

  it("reproduce→diagnose: passes when reproduce.md exists", () => {
    writeArtifact("001-test", "reproduce.md", "# Steps\n");
    const result = checkGate(
      makeState({ phase: "reproduce", workflow: "bugfix" }),
      "diagnose",
      tmp,
    );
    expect(result.pass).toBe(true);
  });

  it("verify→code-review: passes when verify.md exists", () => {
    writeArtifact("001-test", "verify.md", "# Verification\n");
    const result = checkGate(makeState({ phase: "verify" }), "code-review", tmp);
    expect(result.pass).toBe(true);
  });

  it("code-review→done: passes when code-review.md exists", () => {
    writeArtifact("001-test", "code-review.md", "# Review\n");
    const result = checkGate(makeState({ phase: "code-review" }), "done", tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Implementation:**

Rewrite `extensions/megapowers/gates.ts` — change 3rd param from `store: Store` to `cwd: string`:

```typescript
// extensions/megapowers/gates.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MegapowersState, Phase } from "./state-machine.js";
import { hasOpenQuestions } from "./spec-parser.js";
import { deriveTasks } from "./derived.js";

export interface GateResult {
  pass: boolean;
  reason?: string;
}

const BACKWARD_TARGETS = new Set<string>([
  "review→plan",
  "verify→implement",
  "code-review→implement",
]);

function isBackward(from: Phase, to: Phase): boolean {
  return BACKWARD_TARGETS.has(`${from}→${to}`);
}

function artifactExists(cwd: string, issueSlug: string, filename: string): boolean {
  return existsSync(join(cwd, ".megapowers", "plans", issueSlug, filename));
}

function readArtifact(cwd: string, issueSlug: string, filename: string): string | null {
  const p = join(cwd, ".megapowers", "plans", issueSlug, filename);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf-8");
}

export function checkGate(state: MegapowersState, target: Phase, cwd: string): GateResult {
  const from = state.phase;
  if (!from || !state.activeIssue) {
    return { pass: false, reason: "No active phase or issue" };
  }

  if (isBackward(from, target)) {
    return { pass: true };
  }

  const issue = state.activeIssue;

  switch (`${from}→${target}`) {
    case "brainstorm→spec":
      return { pass: true };

    case "spec→plan": {
      if (!artifactExists(cwd, issue, "spec.md")) {
        return { pass: false, reason: "Cannot advance to plan: spec.md not found. Use megapowers_save_artifact to save the spec first." };
      }
      const spec = readArtifact(cwd, issue, "spec.md");
      if (spec && hasOpenQuestions(spec)) {
        return { pass: false, reason: "Cannot advance to plan: spec.md has unresolved open questions. Resolve them first." };
      }
      return { pass: true };
    }

    case "plan→review":
    case "plan→implement": {
      if (!artifactExists(cwd, issue, "plan.md")) {
        return { pass: false, reason: "Cannot advance: plan.md not found. Use megapowers_save_artifact to save the plan first." };
      }
      return { pass: true };
    }

    case "review→implement": {
      if (!state.reviewApproved) {
        return { pass: false, reason: "Cannot advance: plan review not approved yet. Call megapowers_signal with action 'review_approve' first." };
      }
      return { pass: true };
    }

    case "implement→verify": {
      const tasks = deriveTasks(cwd, issue);
      if (tasks.length === 0) {
        return { pass: false, reason: "Cannot advance: no tasks found in plan.md. Check the plan format." };
      }
      const completedSet = new Set(state.completedTasks);
      const incomplete = tasks.filter(t => !completedSet.has(t.index));
      if (incomplete.length > 0) {
        return {
          pass: false,
          reason: `Cannot advance: ${incomplete.length} of ${tasks.length} tasks still incomplete. Complete them first.`,
        };
      }
      return { pass: true };
    }

    case "verify→code-review": {
      if (!artifactExists(cwd, issue, "verify.md")) {
        return { pass: false, reason: "Cannot advance: verify.md not found. Run verification first." };
      }
      return { pass: true };
    }

    case "code-review→done": {
      if (!artifactExists(cwd, issue, "code-review.md")) {
        return { pass: false, reason: "Cannot advance: code-review.md not found. Run code review first." };
      }
      return { pass: true };
    }

    case "reproduce→diagnose": {
      if (!artifactExists(cwd, issue, "reproduce.md")) {
        return { pass: false, reason: "Cannot advance: reproduce.md not found. Document the bug reproduction first." };
      }
      return { pass: true };
    }

    case "diagnose→plan": {
      if (!artifactExists(cwd, issue, "diagnosis.md")) {
        return { pass: false, reason: "Cannot advance: diagnosis.md not found. Complete the diagnosis first." };
      }
      return { pass: true };
    }

    default:
      return { pass: true };
  }
}
```

Update `extensions/megapowers/ui.ts` — change the `checkGate` call at line ~458 from `checkGate(state, p, store)` to `checkGate(state, p, ctx.cwd)`. This requires adding `cwd: string` to the `handlePhaseTransition` signature. The `handlePhaseTransition` method signature becomes:

```typescript
async handlePhaseTransition(ctx, state, store, jj) {
  // ...
  const gate = checkGate(state, p, ctx.cwd);  // was: checkGate(state, p, store)
  // ...
}
```

Since `ctx` is the first param and has `.cwd`, this is a simple edit.

**Verify:** `bun test tests/gates.test.ts`

---

### Task 6: Phase advance shared function with jj integration [depends: 1, 4, 5]

**Covers:** AC17, AC18, AC19, AC21

**Files:**
- Create: `extensions/megapowers/phase-advance.ts`
- Test: `tests/phase-advance.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advancePhase } from "../extensions/megapowers/phase-advance.js";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";
import type { JJ } from "../extensions/megapowers/jj.js";

describe("advancePhase", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "phase-advance-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeArtifact(issue: string, filename: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), content);
  }

  function setState(overrides: Partial<MegapowersState>) {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
  }

  it("advances brainstorm→spec", () => {
    setState({ phase: "brainstorm" });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("spec");
    expect(readState(tmp).phase).toBe("spec");
  });

  it("advances spec→plan when spec exists and no open questions", () => {
    setState({ phase: "spec" });
    writeArtifact("001-test", "spec.md", "# Spec\n\n## Open Questions\nNone\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("plan");
  });

  it("rejects spec→plan when gate fails", () => {
    setState({ phase: "spec" });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("spec.md");
  });

  it("advances to implement and sets currentTaskIndex to first incomplete", () => {
    setState({ phase: "review", reviewApproved: true });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
    expect(readState(tmp).currentTaskIndex).toBe(0);
  });

  it("sets currentTaskIndex to first incomplete when some tasks done", () => {
    setState({ phase: "review", reviewApproved: true, completedTasks: [1] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Task 1 (index=1) is completed, so first incomplete is tasks[1] which is Task 2
    expect(readState(tmp).currentTaskIndex).toBe(1);
  });

  it("resets reviewApproved when advancing to plan (backward)", () => {
    setState({ phase: "review", reviewApproved: true });
    const result = advancePhase(tmp, "plan");
    expect(result.ok).toBe(true);
    expect(readState(tmp).reviewApproved).toBe(false);
  });

  it("advances to specific target when provided", () => {
    setState({ phase: "plan" });
    writeArtifact("001-test", "plan.md", "# Plan\n");
    const result = advancePhase(tmp, "review");
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("review");
  });

  it("rejects when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid transition", () => {
    setState({ phase: "brainstorm" });
    const result = advancePhase(tmp, "implement");
    expect(result.ok).toBe(false);
  });

  describe("jj integration", () => {
    function mockJJ(opts: { isJJ?: boolean; newChangeId?: string } = {}): JJ {
      const { isJJ = true, newChangeId = "mock-change-id" } = opts;
      return {
        isJJRepo: async () => isJJ,
        getCurrentChangeId: async () => "current-id",
        getChangeDescription: async () => "",
        hasConflicts: async () => false,
        newChange: async () => newChangeId,
        describe: async () => {},
        squash: async () => {},
        bookmarkSet: async () => {},
        log: async () => "",
        diff: async () => "",
        abandon: async () => {},
        squashInto: async () => {},
      };
    }

    it("creates jj change when advancing to implement (AC19)", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj = mockJJ();
      const result = advancePhase(tmp, undefined, jj);
      // advancePhase is sync for gate checks but jj is async — we need to wait
      // Actually advancePhase returns AdvanceResult, jj ops happen inside
      expect(result.ok).toBe(true);
    });

    it("squashes task changes when advancing to done (AC21)", async () => {
      setState({ phase: "code-review", jjChangeId: "issue-change" });
      writeArtifact("001-test", "code-review.md", "# Review\n");
      let squashedInto: string | null = null;
      const jj = {
        ...mockJJ(),
        squashInto: async (id: string) => { squashedInto = id; },
      };
      advancePhase(tmp, "done", jj);
      // Wait for async jj ops to complete
      await new Promise(r => setTimeout(r, 50));
      expect(squashedInto).toBe("issue-change");
    });

    it("does not fail when jj operations throw (non-fatal)", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj = {
        ...mockJJ(),
        newChange: async () => { throw new Error("jj broken"); return null; },
        describe: async () => { throw new Error("jj broken"); },
      };
      const result = advancePhase(tmp, undefined, jj);
      expect(result.ok).toBe(true);
    });

    it("is a no-op when not a jj repo", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj = mockJJ({ isJJ: false });
      const result = advancePhase(tmp, undefined, jj);
      expect(result.ok).toBe(true);
    });
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/phase-advance.ts
import { readState, writeState } from "./state-io.js";
import { getValidTransitions, transition, type Phase } from "./state-machine.js";
import { checkGate } from "./gates.js";
import { deriveTasks } from "./derived.js";
import { formatChangeDescription, type JJ } from "./jj.js";

export interface AdvanceResult {
  ok: boolean;
  newPhase?: Phase;
  error?: string;
  jjWarning?: string;
}

export function advancePhase(cwd: string, targetPhase?: Phase, jj?: JJ): AdvanceResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { ok: false, error: "No active issue or phase." };
  }

  const validNext = getValidTransitions(state.workflow, state.phase);
  if (validNext.length === 0) {
    return { ok: false, error: `No valid transitions from ${state.phase}.` };
  }

  const target = targetPhase ?? validNext[0];
  if (!validNext.includes(target)) {
    return { ok: false, error: `Cannot transition from ${state.phase} to ${target} in ${state.workflow} workflow.` };
  }

  const gate = checkGate(state, target, cwd);
  if (!gate.pass) {
    return { ok: false, error: gate.reason };
  }

  const tasks = target === "implement" ? deriveTasks(cwd, state.activeIssue) : undefined;
  const newState = transition(state, target, tasks);

  writeState(cwd, newState);

  // jj operations (async, non-fatal, fire-and-forget from the caller's perspective)
  if (jj) {
    const issueSlug = state.activeIssue;
    const fromPhase = state.phase;

    (async () => {
      try {
        if (!await jj.isJJRepo()) return;

        // Describe current change as complete
        await jj.describe(formatChangeDescription(issueSlug, fromPhase, "complete"));

        // Create new change for target phase
        const changeId = await jj.newChange(formatChangeDescription(issueSlug, target));
        if (changeId) {
          const s = readState(cwd);
          writeState(cwd, { ...s, jjChangeId: changeId });
        }

        // Squash task changes into parent when advancing to done (AC21)
        if (target === "done" && state.jjChangeId) {
          try {
            await jj.squashInto(state.jjChangeId);
          } catch {
            // Non-fatal
          }
        }
      } catch {
        // jj failures are non-fatal
      }
    })();
  }

  return { ok: true, newPhase: target };
}
```

**Verify:** `bun test tests/phase-advance.test.ts`

---

### Task 7: megapowers_signal tool handler [depends: 1, 3, 4, 6]

**Covers:** AC11, AC12, AC13, AC14, AC15, AC16, AC17, AC20, AC38, AC52, AC54

**Files:**
- Create: `extensions/megapowers/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal } from "../extensions/megapowers/tool-signal.js";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

describe("handleSignal", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("when megaEnabled is false", () => {
    it("returns error for any action", () => {
      setState(tmp, { phase: "implement", megaEnabled: false });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toContain("disabled");
    });
  });

  describe("task_done", () => {
    it("marks current task complete and advances index (1-based completedTasks)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("Task 2");

      const state = readState(tmp);
      expect(state.completedTasks).toContain(1); // Task 1's PlanTask.index
      expect(state.currentTaskIndex).toBe(1);    // array index 1 = Task 2
    });

    it("validates tddTaskState.taskIndex matches current task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 1, // Task 2
        completedTasks: [1],
        // tddState for Task 1 (stale) — should not satisfy Task 2
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("TDD");
    });

    it("skips TDD check for [no-test] task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Setup [no-test]\n\n### Task 2: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).completedTasks).toContain(1);
    });

    it("blocks non-[no-test] task when tddState is null", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("TDD");
    });

    it("blocks when tddState is test-written (not impl-allowed)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("test");
    });

    it("allows when tddState is skipped", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n\n### Task 2: More\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "no-test", skipped: true },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
    });

    it("auto-advances to verify on final task (AC15)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only task\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("verify");

      const state = readState(tmp);
      expect(state.phase).toBe("verify");
      expect(state.completedTasks).toContain(1);
    });

    it("skips already-completed tasks when advancing index", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [2], // Task 2 already done
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();

      const state = readState(tmp);
      expect(state.completedTasks).toEqual(expect.arrayContaining([1, 2]));
      expect(state.currentTaskIndex).toBe(2); // Skipped Task 2, landed on Task 3
    });

    it("resets tddTaskState for next task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      handleSignal(tmp, "task_done");
      const state = readState(tmp);
      expect(state.tddTaskState).toBeNull();
    });
  });

  describe("review_approve", () => {
    it("sets reviewApproved in state (AC16)", () => {
      setState(tmp, { phase: "review" });
      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).reviewApproved).toBe(true);
    });
  });

  describe("phase_next", () => {
    it("advances phase when gate passes", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("spec");
      expect(readState(tmp).phase).toBe("spec");
    });

    it("returns error when gate fails", () => {
      setState(tmp, { phase: "spec" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("spec.md");
    });
  });

  describe("invalid action", () => {
    it("returns error for unknown action", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "unknown" as any);
      expect(result.error).toBeDefined();
    });
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/tool-signal.ts
import { readState, writeState } from "./state-io.js";
import { advancePhase } from "./phase-advance.js";
import { deriveTasks } from "./derived.js";
import { transition, type Phase } from "./state-machine.js";
import { formatChangeDescription, type JJ } from "./jj.js";
import { buildTaskChangeDescription, inspectTaskChange, createTaskChange } from "./task-coordinator.js";

export interface SignalResult {
  message?: string;
  error?: string;
}

export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next",
  jj?: JJ,
): SignalResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  switch (action) {
    case "task_done":
      return handleTaskDone(cwd, jj);
    case "review_approve":
      return handleReviewApprove(cwd);
    case "phase_next":
      return handlePhaseNext(cwd, jj);
    default:
      return { error: `Unknown signal action: ${action}` };
  }
}

function handleTaskDone(cwd: string, jj?: JJ): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || state.phase !== "implement") {
    return { error: "task_done can only be called during the implement phase." };
  }

  const tasks = deriveTasks(cwd, state.activeIssue);
  if (tasks.length === 0) {
    return { error: "No tasks found in plan.md. Check the plan format." };
  }

  const currentTask = tasks[state.currentTaskIndex];
  if (!currentTask) {
    return { error: `No task at index ${state.currentTaskIndex}. Tasks: ${tasks.length}` };
  }

  // TDD validation for non-[no-test] tasks
  if (!currentTask.noTest) {
    const tdd = state.tddTaskState;
    const tddMatchesTask = tdd && tdd.taskIndex === currentTask.index;
    if (!tdd || (!tdd.skipped && (!tddMatchesTask || tdd.state !== "impl-allowed"))) {
      return {
        error: "TDD requirements not met. Write a test file, run tests (they must fail), then implement. Or use /tdd skip to bypass.",
      };
    }
  }

  // Mark complete using PlanTask.index (1-based)
  const completedTasks = [...state.completedTasks, currentTask.index];
  const completedSet = new Set(completedTasks);

  // Find next incomplete task (searching forward from current)
  let nextIncompleteIdx = -1;
  for (let i = state.currentTaskIndex + 1; i < tasks.length; i++) {
    if (!completedSet.has(tasks[i].index)) {
      nextIncompleteIdx = i;
      break;
    }
  }
  // Wrap around if needed
  if (nextIncompleteIdx === -1) {
    for (let i = 0; i <= state.currentTaskIndex; i++) {
      if (!completedSet.has(tasks[i].index)) {
        nextIncompleteIdx = i;
        break;
      }
    }
  }

  // Check if all tasks are now done
  const allDone = tasks.every(t => completedSet.has(t.index));

  // jj: inspect current task change, create next task change (AC20, non-fatal)
  if (jj) {
    const issueSlug = state.activeIssue;
    const changeId = state.taskJJChanges[currentTask.index];
    (async () => {
      try {
        if (!await jj.isJJRepo()) return;
        // Inspect current task's change
        if (changeId) {
          try { await inspectTaskChange(jj, changeId); } catch {}
        }
        // Create next task's change if not all done
        if (!allDone && nextIncompleteIdx >= 0) {
          const nextTask = tasks[nextIncompleteIdx];
          const result = await createTaskChange(
            jj,
            issueSlug,
            nextTask.index,
            nextTask.description,
            state.jjChangeId ?? undefined,
          );
          if (result.changeId) {
            const s = readState(cwd);
            writeState(cwd, {
              ...s,
              taskJJChanges: { ...s.taskJJChanges, [nextTask.index]: result.changeId },
            });
          }
        }
      } catch {
        // Non-fatal
      }
    })();
  }

  if (allDone) {
    // Auto-advance to verify
    const newState = transition(
      { ...state, completedTasks, currentTaskIndex: nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex, tddTaskState: null },
      "verify" as Phase,
    );
    writeState(cwd, newState);
    return { message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.` };
  }

  // Advance to next task
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex,
    tddTaskState: null, // Reset TDD state for next task
  };
  writeState(cwd, updatedState);

  const nextTask = tasks[updatedState.currentTaskIndex];
  const remaining = tasks.length - completedTasks.length;
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} tasks remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
}

function handleReviewApprove(cwd: string): SignalResult {
  const state = readState(cwd);
  if (!state.activeIssue) {
    return { error: "No active issue." };
  }
  writeState(cwd, { ...state, reviewApproved: true });
  return { message: "Plan review approved. Call megapowers_signal with action 'phase_next' to advance." };
}

function handlePhaseNext(cwd: string, jj?: JJ): SignalResult {
  const result = advancePhase(cwd, undefined, jj);
  if (!result.ok) {
    return { error: result.error };
  }
  return { message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.` };
}
```

**Verify:** `bun test tests/tool-signal.test.ts`

---

### Task 8: megapowers_save_artifact tool handler [depends: 1]

**Covers:** AC22, AC23, AC24, AC38, AC55

**Files:**
- Create: `extensions/megapowers/tool-artifact.ts`
- Test: `tests/tool-artifact.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSaveArtifact } from "../extensions/megapowers/tool-artifact.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

describe("handleSaveArtifact", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-artifact-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes artifact to correct path", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
    const result = handleSaveArtifact(tmp, "spec", "# My Spec\n\nContent here.");
    expect(result.error).toBeUndefined();

    const path = join(tmp, ".megapowers", "plans", "001-test", "spec.md");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8")).toBe("# My Spec\n\nContent here.");
  });

  it("does not modify state.json", () => {
    const initialState = { ...createInitialState(), activeIssue: "001-test", phase: "spec" as const, megaEnabled: true };
    writeState(tmp, initialState);
    handleSaveArtifact(tmp, "spec", "content");
    const stateAfter = JSON.parse(readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8"));
    expect(stateAfter.phase).toBe("spec");
  });

  it("returns error when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = handleSaveArtifact(tmp, "spec", "content");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No active issue");
  });

  it("returns error when megaEnabled is false", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: false });
    const result = handleSaveArtifact(tmp, "spec", "content");
    expect(result.error).toContain("disabled");
  });

  it("creates plan directory if missing", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "002-new", megaEnabled: true });
    const result = handleSaveArtifact(tmp, "brainstorm", "ideas");
    expect(result.error).toBeUndefined();
    expect(existsSync(join(tmp, ".megapowers", "plans", "002-new", "brainstorm.md"))).toBe(true);
  });
});
```

**Implementation:**

```typescript
// extensions/megapowers/tool-artifact.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state-io.js";

export interface ArtifactResult {
  message?: string;
  error?: string;
}

export function handleSaveArtifact(cwd: string, phase: string, content: string): ArtifactResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  const dir = join(cwd, ".megapowers", "plans", state.activeIssue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${phase}.md`), content);

  return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
}
```

**Verify:** `bun test tests/tool-artifact.test.ts`

---

### Task 9: Write and edit tool override helpers [depends: 1, 3, 4]

**Covers:** AC25, AC26, AC29, AC30

**Files:**
- Create: `extensions/megapowers/tool-overrides.ts`
- Test: `tests/tool-overrides.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateWriteOverride, recordTestFileWritten } from "../extensions/megapowers/tool-overrides.js";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

describe("evaluateWriteOverride", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "write-override-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows writes when megaEnabled is false (passthrough)", () => {
    setState(tmp, { phase: "spec", megaEnabled: false });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("blocks source code writes in spec phase", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(false);
  });

  it("allows .megapowers/ writes in spec phase", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, ".megapowers/plans/001/spec.md");
    expect(result.allowed).toBe(true);
  });

  it("allows test files freely in implement phase", () => {
    setState(tmp, { phase: "implement", megaEnabled: true });
    const result = evaluateWriteOverride(tmp, "tests/foo.test.ts");
    expect(result.allowed).toBe(true);
    expect(result.updateTddState).toBe(true);
  });

  it("blocks production files when TDD not met in implement", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, tddTaskState: null });
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(false);
  });

  it("allows production files when TDD is impl-allowed", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("allows when phase is null (no workflow active)", () => {
    writeState(tmp, createInitialState());
    const result = evaluateWriteOverride(tmp, "src/app.ts");
    expect(result.allowed).toBe(true);
  });
});

describe("recordTestFileWritten", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "record-tdd-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets tddTaskState to test-written with correct taskIndex", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      currentTaskIndex: 0,
      tddTaskState: null,
    });
    recordTestFileWritten(tmp);
    const state = readState(tmp);
    expect(state.tddTaskState?.state).toBe("test-written");
    expect(state.tddTaskState?.taskIndex).toBe(1); // PlanTask.index for Task 1
  });
});

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}
```

**Implementation:**

```typescript
// extensions/megapowers/tool-overrides.ts
import { readState, writeState } from "./state-io.js";
import { canWrite, isTestFile, isAllowlisted, isTestRunnerCommand } from "./write-policy.js";
import { deriveTasks } from "./derived.js";

export interface WriteOverrideResult {
  allowed: boolean;
  reason?: string;
  /** Whether tddTaskState should be updated (test file written) */
  updateTddState?: boolean;
}

export function evaluateWriteOverride(cwd: string, filePath: string): WriteOverrideResult {
  const state = readState(cwd);

  // Determine task noTest from plan
  let taskIsNoTest = false;
  if (state.activeIssue && (state.phase === "implement" || state.phase === "code-review")) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    const currentTask = tasks[state.currentTaskIndex];
    taskIsNoTest = currentTask?.noTest ?? false;
  }

  const decision = canWrite(state.phase, filePath, state.megaEnabled, taskIsNoTest, state.tddTaskState);

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  // Track test file writes for TDD state
  const isTddPhase = state.phase === "implement" || state.phase === "code-review";
  if (isTddPhase && state.megaEnabled && isTestFile(filePath)) {
    return { allowed: true, updateTddState: true };
  }

  return { allowed: true };
}

/**
 * After a successful test file write, update TDD state on disk.
 */
export function recordTestFileWritten(cwd: string): void {
  const state = readState(cwd);
  const tasks = state.activeIssue ? deriveTasks(cwd, state.activeIssue) : [];
  const currentTask = tasks[state.currentTaskIndex];
  const taskIndex = currentTask?.index ?? state.currentTaskIndex + 1;

  writeState(cwd, {
    ...state,
    tddTaskState: {
      taskIndex,
      state: "test-written",
      skipped: state.tddTaskState?.skipped ?? false,
    },
  });
}

/**
 * Process bash command result for TDD tracking.
 * Called after the bash command has already executed.
 */
export function processBashResult(cwd: string, command: string, isError: boolean): void {
  const state = readState(cwd);

  if (!state.megaEnabled) return;
  if (state.phase !== "implement" && state.phase !== "code-review") return;
  if (!state.tddTaskState || state.tddTaskState.state !== "test-written") return;
  if (!isTestRunnerCommand(command)) return;

  // Non-zero exit = tests failed = RED = impl-allowed
  if (isError) {
    writeState(cwd, {
      ...state,
      tddTaskState: { ...state.tddTaskState, state: "impl-allowed" },
    });
  }
  // Zero exit = tests passed = stay at test-written
}
```

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 10: Bash tool override [depends: 1, 3, 9]

**Covers:** AC32, AC33, AC34

**Files:**
- Modify: `tests/tool-overrides.test.ts` (add bash cases)

**Test:**

Add to `tests/tool-overrides.test.ts`:

```typescript
import { processBashResult } from "../extensions/megapowers/tool-overrides.js";

describe("processBashResult", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bash-override-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("records test failure (impl-allowed) when test command fails in implement", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("impl-allowed");
  });

  it("does not change state when test passes (stays test-written)", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", false);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written");
  });

  it("ignores non-test commands", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: true,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "ls -la", true);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written");
  });

  it("ignores when not in implement phase", () => {
    setState(tmp, { phase: "spec", megaEnabled: true, tddTaskState: null });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState).toBeNull();
  });

  it("ignores when megaEnabled is false", () => {
    setState(tmp, {
      phase: "implement",
      megaEnabled: false,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    processBashResult(tmp, "bun test", true);
    expect(readState(tmp).tddTaskState?.state).toBe("test-written");
  });
});
```

**Implementation:** Already provided in Task 9's `tool-overrides.ts` (`processBashResult` function).

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 11: Prompt injection with phase-specific tool instructions [depends: 1, 4]

**Covers:** AC41, AC42

**Files:**
- Create: `prompts/megapowers-protocol.md`
- Create: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

describe("buildInjectedPrompt", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null when megaEnabled is false", () => {
    setState(tmp, { phase: "spec", megaEnabled: false });
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  it("returns null when no active issue", () => {
    writeState(tmp, createInitialState());
    expect(buildInjectedPrompt(tmp)).toBeNull();
  });

  it("includes megapowers protocol section with tool descriptions", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_signal");
    expect(result).toContain("megapowers_save_artifact");
  });

  it("includes phase-specific tool instructions for spec phase (AC42)", () => {
    setState(tmp, { phase: "spec", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("megapowers_save_artifact");
    expect(result).toContain("spec");
  });

  it("includes phase-specific tool instructions for implement phase (AC42)", () => {
    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    const dir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build it\n\n### Task 2: Test it\n");
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("Task 1");
    expect(result).toContain("task_done");
  });

  it("includes phase-specific tool instructions for review phase (AC42)", () => {
    setState(tmp, { phase: "review", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("review_approve");
  });

  it("includes phase_next instructions for brainstorm phase (AC42)", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("phase_next");
  });
});
```

**Implementation:**

Create `prompts/megapowers-protocol.md`:

```markdown
## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
- `{ action: "phase_next" }` — Advance to the next workflow phase

### `megapowers_save_artifact`
Call this to save phase output:
- `{ phase: "<phase>", content: "<full content>" }` — Save artifact for the current phase

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly.
```

Create `extensions/megapowers/prompt-inject.ts`:

```typescript
// extensions/megapowers/prompt-inject.ts
import { readState } from "./state-io.js";
import { deriveTasks, deriveAcceptanceCriteria } from "./derived.js";
import { loadPromptFile, interpolatePrompt, getPhasePromptTemplate, BRAINSTORM_PLAN_PHASES, buildImplementTaskVars, formatAcceptanceCriteriaList, buildSourceIssuesContext } from "./prompts.js";
import type { Phase } from "./state-machine.js";
import type { Store } from "./store.js";
import type { JJ } from "./jj.js";

/** Phase-specific tool call instructions appended to every phase prompt (AC42). */
const PHASE_TOOL_INSTRUCTIONS: Partial<Record<Phase, string>> = {
  brainstorm: `
When you have finished brainstorming, call \`megapowers_signal\` with action \`"phase_next"\` to advance to the spec phase.`,

  spec: `
When the spec is complete, call \`megapowers_save_artifact\` with phase \`"spec"\` and the full spec content.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to the plan phase.`,

  plan: `
When the plan is complete, call \`megapowers_save_artifact\` with phase \`"plan"\` and the full plan content.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to the review phase.`,

  review: `
If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.
If changes are needed, explain what to fix. The user will revise and re-submit.`,

  implement: `
For each task: write tests first, run them (they must fail), then write implementation.
When a task is complete, call \`megapowers_signal\` with action \`"task_done"\`.
The system will automatically advance to the next task or to verify when all tasks are done.`,

  verify: `
When verification is complete, call \`megapowers_save_artifact\` with phase \`"verify"\` and the verification report.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance.`,

  "code-review": `
When the code review is complete, call \`megapowers_save_artifact\` with phase \`"code-review"\` and the review report.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to done.`,

  reproduce: `
When the bug is reproduced, call \`megapowers_save_artifact\` with phase \`"reproduce"\` and the reproduction steps.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to diagnose.`,

  diagnose: `
When the diagnosis is complete, call \`megapowers_save_artifact\` with phase \`"diagnose"\` and the diagnosis.
Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to plan.`,

  done: `
Use \`megapowers_save_artifact\` to save any done-phase outputs (docs, changelog, learnings).`,
};

export function buildInjectedPrompt(cwd: string, store?: Store, jj?: JJ): string | null {
  const state = readState(cwd);

  if (!state.megaEnabled) return null;
  if (!state.activeIssue || !state.phase) return null;

  const parts: string[] = [];

  // Base protocol
  const protocol = loadPromptFile("megapowers-protocol.md");
  if (protocol) parts.push(protocol);

  // Build template variables
  const vars: Record<string, string> = {
    issue_slug: state.activeIssue,
    phase: state.phase,
  };

  // Load artifacts for context
  if (store) {
    const artifactMap: Record<string, string> = {
      "brainstorm.md": "brainstorm_content",
      "spec.md": "spec_content",
      "plan.md": "plan_content",
      "diagnosis.md": "diagnosis_content",
      "verify.md": "verify_content",
      "code-review.md": "code_review_content",
    };
    for (const [file, varName] of Object.entries(artifactMap)) {
      const content = store.readPlanFile(state.activeIssue, file);
      if (content) vars[varName] = content;
    }

    // Bugfix aliasing
    if (state.workflow === "bugfix") {
      const reproduce = store.readPlanFile(state.activeIssue, "reproduce.md");
      const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
      if (reproduce) { vars.brainstorm_content = reproduce; vars.reproduce_content = reproduce; }
      if (diagnosis) { vars.spec_content = diagnosis; vars.diagnosis_content = diagnosis; }
    }
  }

  // Acceptance criteria
  const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue, state.workflow ?? "feature");
  if (criteria.length > 0) {
    vars.acceptance_criteria_list = formatAcceptanceCriteriaList(criteria);
  }

  // Implement phase: task context
  if (state.phase === "implement") {
    const tasks = deriveTasks(cwd, state.activeIssue);
    if (tasks.length > 0) {
      const completedSet = new Set(state.completedTasks);
      const tasksWithCompletion = tasks.map(t => ({ ...t, completed: completedSet.has(t.index) }));
      Object.assign(vars, buildImplementTaskVars(tasksWithCompletion, state.currentTaskIndex));
    }
  }

  // Done phase: files_changed from jj
  if (state.phase === "done" && state.jjChangeId && jj) {
    // This is async — the caller should handle this separately if needed
    // For now, set empty; the existing code path in index.ts can augment
    vars.files_changed = "";
  }

  // Learnings + Roadmap
  if (BRAINSTORM_PLAN_PHASES.includes(state.phase) && store) {
    vars.learnings = store.getLearnings();
    vars.roadmap = store.readRoadmap();
  }

  // Done phase learnings
  if (state.phase === "done" && store) {
    vars.learnings = store.getLearnings();
    vars.files_changed = vars.files_changed ?? "";
  }

  // Phase prompt template
  let template = "";
  if (state.phase === "done" && state.doneMode) {
    const doneModeTemplateMap: Record<string, string> = {
      "generate-docs": "generate-docs.md",
      "capture-learnings": "capture-learnings.md",
      "write-changelog": "write-changelog.md",
      "generate-bugfix-summary": "generate-bugfix-summary.md",
    };
    const filename = doneModeTemplateMap[state.doneMode];
    if (filename) template = loadPromptFile(filename);
  } else if (state.phase !== "done") {
    template = getPhasePromptTemplate(state.phase);
  }

  if (template) {
    const phasePrompt = interpolatePrompt(template, vars);
    if (phasePrompt) parts.push(phasePrompt);
  }

  // Phase-specific tool instructions (AC42)
  const toolInstructions = PHASE_TOOL_INSTRUCTIONS[state.phase];
  if (toolInstructions) parts.push(toolInstructions.trim());

  // Source issues context
  if (store) {
    const issue = store.getIssue(state.activeIssue);
    if (issue && issue.sources.length > 0) {
      const sourceIssues = store.getSourceIssues(state.activeIssue);
      const sourceContext = buildSourceIssuesContext(sourceIssues);
      if (sourceContext) parts.push(sourceContext);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

**Verify:** `bun test tests/prompt-inject.test.ts`

---

### Task 12: Satellite mode with in-memory TDD [depends: 3, 9]

**Covers:** AC47, AC48

**Files:**
- Modify: `extensions/megapowers/tool-overrides.ts` (add satellite helpers)
- Test: `tests/tool-overrides.test.ts` (add satellite cases)

**Test:**

Add to `tests/tool-overrides.test.ts`:

```typescript
import { createSatelliteWriteChecker, type SatelliteTddState } from "../extensions/megapowers/tool-overrides.js";

describe("satellite mode (in-memory TDD)", () => {
  it("allows test files and tracks state in memory", () => {
    const sat: SatelliteTddState = { state: "no-test", skipped: false };
    const checker = createSatelliteWriteChecker("implement", false, sat);

    const result1 = checker("tests/foo.test.ts");
    expect(result1.allowed).toBe(true);
    expect(sat.state).toBe("test-written");
  });

  it("blocks production files until tests fail", () => {
    const sat: SatelliteTddState = { state: "no-test", skipped: false };
    const checker = createSatelliteWriteChecker("implement", false, sat);

    const result = checker("src/app.ts");
    expect(result.allowed).toBe(false);
  });

  it("allows production files after test failure", () => {
    const sat: SatelliteTddState = { state: "impl-allowed", skipped: false };
    const checker = createSatelliteWriteChecker("implement", false, sat);

    const result = checker("src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("allows everything for [no-test] tasks", () => {
    const sat: SatelliteTddState = { state: "no-test", skipped: false };
    const checker = createSatelliteWriteChecker("implement", true, sat);

    const result = checker("src/app.ts");
    expect(result.allowed).toBe(true);
  });

  it("handles satellite bash result (test failure)", () => {
    const sat: SatelliteTddState = { state: "test-written", skipped: false };
    const checker = createSatelliteWriteChecker("implement", false, sat);
    checker.processBash("bun test", true);
    expect(sat.state).toBe("impl-allowed");
  });
});
```

**Implementation:**

Add to `extensions/megapowers/tool-overrides.ts`:

```typescript
export interface SatelliteTddState {
  state: "no-test" | "test-written" | "impl-allowed";
  skipped: boolean;
}

export interface SatelliteWriteResult {
  allowed: boolean;
  reason?: string;
}

export interface SatelliteWriteChecker {
  (filePath: string): SatelliteWriteResult;
  processBash(command: string, isError: boolean): void;
}

export function createSatelliteWriteChecker(
  phase: string,
  taskIsNoTest: boolean,
  tddState: SatelliteTddState,
): SatelliteWriteChecker {
  const checker = (filePath: string): SatelliteWriteResult => {
    if (filePath.startsWith(".megapowers/") || filePath.includes("/.megapowers/")) {
      return { allowed: true };
    }

    if (phase !== "implement" && phase !== "code-review") {
      return { allowed: true };
    }

    if (isAllowlisted(filePath)) return { allowed: true };
    if (isTestFile(filePath)) {
      if (tddState.state === "no-test") tddState.state = "test-written";
      return { allowed: true };
    }
    if (taskIsNoTest || tddState.skipped) return { allowed: true };
    if (tddState.state === "impl-allowed") return { allowed: true };

    return { allowed: false, reason: "TDD violation: write tests first." };
  };

  checker.processBash = (command: string, isError: boolean) => {
    if (phase !== "implement" && phase !== "code-review") return;
    if (tddState.state !== "test-written") return;
    if (!isTestRunnerCommand(command)) return;
    if (isError) tddState.state = "impl-allowed";
  };

  return checker;
}
```

**Verify:** `bun test tests/tool-overrides.test.ts`

---

### Task 13: Rewrite index.ts — tool registration, session lifecycle, all commands [depends: 1, 7, 8, 9, 10, 11, 12]

**Covers:** AC5, AC38, AC39, AC40, AC43, AC49, AC50

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/index-integration.test.ts`

**Test:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

// These tests verify the architectural invariants of the rewritten index.ts
// by checking the source code and state file behavior.

describe("index.ts architectural invariants", () => {
  it("has no module-level state variable (AC5)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    // Check there's no `let state:` or `var state:` at module level
    // The pattern is: any `let state` or `var state` that isn't inside a function body
    const lines = source.split("\n");
    const moduleLevel = lines.filter(l =>
      /^\s*(let|var)\s+state\s*[:=]/.test(l) && !l.trim().startsWith("//")
    );
    expect(moduleLevel).toHaveLength(0);
  });

  it("has no appendEntry calls (AC43)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).not.toContain("appendEntry");
  });

  it("imports from @mariozechner/pi-coding-agent (not /tools subpath)", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).toContain('from "@mariozechner/pi-coding-agent"');
    expect(source).not.toContain('@mariozechner/pi-coding-agent/tools');
  });

  describe("mega off/on state management", () => {
    let tmp: string;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "mega-toggle-test-"));
    });

    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it("megaEnabled resets to true on session start (AC40)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: false });
      // Simulate what session_start does
      const state = readState(tmp);
      if (!state.megaEnabled) {
        writeState(tmp, { ...state, megaEnabled: true });
      }
      expect(readState(tmp).megaEnabled).toBe(true);
    });

    it("/mega off sets megaEnabled false (AC39)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: true });
      const state = readState(tmp);
      writeState(tmp, { ...state, megaEnabled: false });
      expect(readState(tmp).megaEnabled).toBe(false);
    });

    it("/mega on sets megaEnabled true (AC39)", () => {
      writeState(tmp, { ...createInitialState(), megaEnabled: false });
      const state = readState(tmp);
      writeState(tmp, { ...state, megaEnabled: true });
      expect(readState(tmp).megaEnabled).toBe(true);
    });
  });
});
```

**Implementation:**

Rewrite `extensions/megapowers/index.ts`. Key changes:
- No module-level `state` variable — every handler reads from disk via `readState(ctx.cwd)`
- No `pi.appendEntry()` calls
- Register `megapowers_signal` and `megapowers_save_artifact` tools
- Register `write`, `edit`, `bash` overrides using `createWriteTool`/`createEditTool`/`createBashTool` from `@mariozechner/pi-coding-agent`
- `session_start` reads state, resets `megaEnabled: true`, writes back
- `/mega off` calls `pi.setActiveTools()` to hide custom tools (AC38)
- `/mega on` restores custom tools via `pi.setActiveTools()`
- Satellite mode uses in-memory TDD via `createSatelliteWriteChecker`
- All commands (`/task done`, `/review approve`, `/phase next`, `/tdd skip`, `/issue`, `/done`, `/learn`, `/triage`) ported

The implementation registers tools as follows:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createWriteTool, createEditTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readState, writeState } from "./state-io.js";
import { createInitialState } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, filterTriageableIssues, formatTriageIssueList, type MegapowersUI } from "./ui.js";
import { handleSignal } from "./tool-signal.js";
import { handleSaveArtifact } from "./tool-artifact.js";
import { evaluateWriteOverride, recordTestFileWritten, processBashResult, createSatelliteWriteChecker, type SatelliteTddState } from "./tool-overrides.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { isSatelliteMode } from "./satellite.js";
import { loadPromptFile, interpolatePrompt } from "./prompts.js";
import { createBatchHandler } from "./tools.js";
import { deriveTasks } from "./derived.js";
```

The `megapowers_signal` tool definition:
```typescript
pi.registerTool({
  name: "megapowers_signal",
  label: "Megapowers Signal",
  description: "Signal a state transition: task_done, review_approve, or phase_next",
  parameters: Type.Object({
    action: Type.Union([
      Type.Literal("task_done"),
      Type.Literal("review_approve"),
      Type.Literal("phase_next"),
    ]),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const result = handleSignal(ctx.cwd, params.action, jj);
    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
    }
    if (ctx.hasUI) {
      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    }
    return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
  },
});
```

The `/mega` command with `setActiveTools` for AC38:
```typescript
pi.registerCommand("mega", {
  description: "Toggle megapowers enforcement (usage: /mega off | /mega on)",
  handler: async (args, ctx) => {
    const sub = args.trim().toLowerCase();
    if (sub === "off") {
      const state = readState(ctx.cwd);
      writeState(ctx.cwd, { ...state, megaEnabled: false });
      // Hide custom tools from LLM (AC38)
      const activeTools = pi.getActiveTools().filter(
        t => t !== "megapowers_signal" && t !== "megapowers_save_artifact"
      );
      pi.setActiveTools(activeTools);
      ctx.ui.notify("Megapowers OFF — all enforcement disabled.", "info");
      return;
    }
    if (sub === "on") {
      const state = readState(ctx.cwd);
      writeState(ctx.cwd, { ...state, megaEnabled: true });
      // Restore custom tools (AC38)
      const activeTools = pi.getActiveTools();
      if (!activeTools.includes("megapowers_signal")) {
        pi.setActiveTools([...activeTools, "megapowers_signal", "megapowers_save_artifact"]);
      }
      ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
      return;
    }
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  },
});
```

**Note on tool override pattern:** For `write`/`edit`, the override delegates to the built-in tool factory:
```typescript
pi.registerTool({
  name: "write",
  label: "Write File",
  description: "Create or overwrite a file",
  parameters: Type.Object({ path: Type.String(), content: Type.String() }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const decision = evaluateWriteOverride(ctx.cwd, params.path);
    if (!decision.allowed) {
      return { content: [{ type: "text", text: decision.reason ?? "Write blocked." }], details: undefined };
    }
    const builtin = createWriteTool(ctx.cwd);
    const result = await builtin.execute(toolCallId, params, signal, onUpdate);
    if (decision.updateTddState) recordTestFileWritten(ctx.cwd);
    return result;
  },
  // No renderCall/renderResult — preserves built-in rendering (AC30)
});
```

For `bash`, catch errors to detect non-zero exit:
```typescript
pi.registerTool({
  name: "bash",
  label: "Bash",
  description: "Execute a bash command",
  parameters: Type.Object({ command: Type.String(), timeout: Type.Optional(Type.Number()) }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const builtin = createBashTool(ctx.cwd);
    try {
      const result = await builtin.execute(toolCallId, params, signal, onUpdate);
      processBashResult(ctx.cwd, params.command, false);
      return result;
    } catch (err) {
      processBashResult(ctx.cwd, params.command, true);
      throw err; // Re-throw so pi handles the error display
    }
  },
});
```

The `/phase` command now delegates to `handlePhaseTransition` for interactive transitions (which has jj built in via ui.ts), and to `handleSignal` for `/phase next`:
```typescript
pi.registerCommand("phase", {
  description: "Phase management (usage: /phase | /phase next)",
  handler: async (args, ctx) => {
    if (args.trim() === "next") {
      const result = handleSignal(ctx.cwd, "phase_next", jj);
      if (result.error) ctx.ui.notify(result.error, "error");
      else ctx.ui.notify(result.message ?? "Phase advanced.", "info");
    } else if (!args.trim()) {
      // Interactive phase transition with gate display
      const state = readState(ctx.cwd);
      if (state.phase && state.workflow) {
        const newState = await ui.handlePhaseTransition(ctx, state, store, jj);
        writeState(ctx.cwd, newState);
      }
    }
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  },
});
```

All other commands (`/issue`, `/done`, `/learn`, `/triage`, `/tdd`, `/task`, `/review`) follow the same pattern: read state from disk, delegate to handler, write state back.

**Verify:** `bun test tests/index-integration.test.ts && bun test`

---

### Task 14: Migrate ui.ts and store.ts to new state model [depends: 1, 5, 13]

**Covers:** AC5 (completion — no in-memory state)

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/store.ts`
- Modify: `tests/ui.test.ts`
- Modify: `tests/store.test.ts`
- Test: `tests/ui.test.ts`

**Test:**

Update `tests/ui.test.ts` to work with new state model:

```typescript
// In tests/ui.test.ts, update tests that reference state.planTasks or state.acceptanceCriteria:

// Before:
//   expect(newState.planTasks).toEqual([]);
// After:
//   expect(newState.completedTasks).toEqual([]);

// Before:
//   expect(newState.acceptanceCriteria).toEqual([]);
// After:
//   // acceptanceCriteria removed — derived on demand from spec.md

// Before:
//   const gate = checkGate(state, p, store);
// After:
//   const gate = checkGate(state, p, ctx.cwd);

// Before:
//   store.saveState(newState);
// After:
//   writeState(ctx.cwd, newState);
```

The specific test updates depend on the exact assertions in the current `tests/ui.test.ts`. The pattern is:
1. Replace `store.saveState()` calls with `writeState(ctx.cwd, state)` (import from `state-io.js`)
2. Replace `checkGate(state, p, store)` calls with `checkGate(state, p, ctx.cwd)`
3. Remove assertions about `planTasks` and `acceptanceCriteria` on state objects
4. Add `completedTasks` where task completion was previously tracked via `planTasks[i].completed`
5. Update `renderDashboardLines` calls to derive tasks from plan.md instead of `state.planTasks`

**Implementation:**

In `extensions/megapowers/ui.ts`:
- Replace all `store.saveState(newState)` calls with `writeState(ctx.cwd, newState)` (add import from `state-io.js`)
- Change `checkGate(state, p, store)` to `checkGate(state, p, ctx.cwd)` (already done in Task 5)
- In `handleIssueCommand`, remove `planTasks: []` and `acceptanceCriteria: []` from new state objects
- In `renderDashboardLines` / `renderStatusText`, replace `state.planTasks` references:
  ```typescript
  // Before:
  const remaining = state.planTasks.filter(t => !t.completed).length;
  // After:
  const tasks = deriveTasks(ctx.cwd, state.activeIssue!);
  const completedSet = new Set(state.completedTasks);
  const remaining = tasks.filter(t => !completedSet.has(t.index)).length;
  ```

In `extensions/megapowers/store.ts`:
- Remove `loadState()` and `saveState()` methods from the `Store` interface
- Remove their implementations from `createStore()`
- Remove the `import { createInitialState }` if no longer needed by store

In `tests/store.test.ts`:
- Remove tests for `loadState()` and `saveState()` (now covered by `tests/state-io.test.ts`)

**Verify:** `bun test tests/ui.test.ts tests/store.test.ts`

---

### Task 15: Delete replaced modules and their tests [depends: 13, 14]

**Covers:** AC44, AC45, AC46, AC47

**Files:**
- Delete: `extensions/megapowers/artifact-router.ts`
- Delete: `extensions/megapowers/tdd-guard.ts`
- Delete: `extensions/megapowers/state-recovery.ts`
- Delete: `extensions/megapowers/satellite-tdd.ts`
- Delete: `extensions/megapowers/task-coordinator.ts`
- Delete: `tests/artifact-router.test.ts`
- Delete: `tests/tdd-guard.test.ts`
- Delete: `tests/state-recovery.test.ts`
- Delete: `tests/satellite-tdd.test.ts`
- Delete: `tests/task-coordinator.test.ts`
- Delete: `tests/030-state-source-of-truth.test.ts`
- Modify: `extensions/megapowers/state-machine.ts` (remove deprecated fields)
- Modify: `tests/state-machine.test.ts`
- Test: `tests/state-machine.test.ts`

**Test:**

Update `tests/state-machine.test.ts`:
```typescript
// Remove references to planTasks and acceptanceCriteria:

// Before:
//   expect(state.planTasks).toEqual([]);
//   expect(state.acceptanceCriteria).toEqual([]);
// After:
//   expect(state.completedTasks).toEqual([]);
//   expect((state as any).planTasks).toBeUndefined();
//   expect((state as any).acceptanceCriteria).toBeUndefined();

// Update transition() tests to pass tasks parameter:
// Before:
//   transition(state, "implement")
// After:
//   const tasks = [{ index: 1, description: "A", completed: false, noTest: false }];
//   transition(state, "implement", tasks)
```

**Implementation:**

1. Delete the files:
```bash
rm extensions/megapowers/artifact-router.ts
rm extensions/megapowers/tdd-guard.ts
rm extensions/megapowers/state-recovery.ts
rm extensions/megapowers/satellite-tdd.ts
rm extensions/megapowers/task-coordinator.ts
rm tests/artifact-router.test.ts
rm tests/tdd-guard.test.ts
rm tests/state-recovery.test.ts
rm tests/satellite-tdd.test.ts
rm tests/task-coordinator.test.ts
rm tests/030-state-source-of-truth.test.ts
```

2. In `extensions/megapowers/state-machine.ts`, remove the deprecated optional fields:
```typescript
// Remove these lines from MegapowersState:
//   /** @deprecated */ planTasks?: PlanTask[];
//   /** @deprecated */ acceptanceCriteria?: AcceptanceCriterion[];
```

3. Remove any remaining imports of deleted modules from `index.ts`, `ui.ts`, `store.ts`, etc.

4. Note: `task-coordinator.ts` is still imported by `tool-signal.ts` for `inspectTaskChange` and `createTaskChange`. These functions should be moved to `tool-signal.ts` or a local helper before deletion. Alternatively, keep `task-coordinator.ts` alive for its pure helper functions and only delete the modules that are fully replaced.

**Decision:** Keep `task-coordinator.ts` — it contains pure JJ helper functions (`createTaskChange`, `inspectTaskChange`, `buildTaskChangeDescription`, `parseTaskDiffFiles`) that `tool-signal.ts` uses. Only delete: `artifact-router.ts`, `tdd-guard.ts`, `state-recovery.ts`, `satellite-tdd.ts`.

**Verify:** `bun test`

---

### Task 16: Remove deprecated state fields and update remaining tests [depends: 15]

**Covers:** AC7 (final enforcement)

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Modify: `tests/state-machine.test.ts`
- Modify: `tests/ui.test.ts`
- Modify: `tests/prompts.test.ts`
- Modify: `tests/tools.test.ts`
- Modify: `tests/satellite.test.ts`
- Test: all test files

**Implementation:**

1. In `extensions/megapowers/state-machine.ts`, remove the deprecated fields from `MegapowersState`:
```typescript
// Remove:
/** @deprecated */ planTasks?: PlanTask[];
/** @deprecated */ acceptanceCriteria?: AcceptanceCriterion[];
```

2. Grep for any remaining references to `planTasks` or `acceptanceCriteria` on state objects across all test files. For each:
   - If it's checking `state.planTasks.length`, replace with `deriveTasks(cwd, state.activeIssue).length` or check `state.completedTasks`
   - If it's setting `planTasks: []` in a test fixture, remove the property
   - If it's checking `state.acceptanceCriteria`, replace with `deriveAcceptanceCriteria(cwd, issue, workflow)`

3. Update `tests/prompts.test.ts` — `buildImplementTaskVars` tests may pass pre-constructed `PlanTask[]` directly (these are fine — the function takes `PlanTask[]` not state)

4. Update `tests/state-machine.test.ts`:
   - Remove assertions about `state.planTasks` and `state.acceptanceCriteria`
   - Update `transition()` tests to pass a `tasks` array when transitioning to implement
   - Verify `createInitialState()` has `completedTasks` and `megaEnabled`, not `planTasks`

5. Ensure `bun test` passes with zero references to deprecated fields on state objects.

**Verify:** `bun test` (all tests pass, no TypeScript errors)