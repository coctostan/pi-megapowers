# TDD Enforcement (tdd-guard) Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** A mechanical TDD enforcer that intercepts file writes during the `implement` phase, requiring a failing test before production code can be written.

**Architecture:** A new `tdd-guard.ts` module with pure functions that implement a per-task state machine (`no-test → test-written → test-failing → impl-allowed`). The guard hooks into pi's `tool_call` event to block production file writes and `tool_result` event to detect test runner failures. Plan parser is extended to support `[no-test]` tags. A `/tdd skip` command provides runtime bypass.

**Tech Stack:** TypeScript, bun:test, pi extension API (`tool_call`/`tool_result` events)

---

## Phase 1: Core tdd-guard module (pure functions)

### Task 1: Add `noTest` field to PlanTask and update plan-parser

**Files:**
- Modify: `extensions/megapowers/state-machine.ts` (PlanTask interface)
- Modify: `extensions/megapowers/plan-parser.ts` (parse `[no-test]` tag)
- Modify: `tests/plan-parser.test.ts` (new test cases)

**Step 1: Write the failing tests for `[no-test]` parsing**

Add to `tests/plan-parser.test.ts`:

```typescript
it("extracts [no-test] tag from task headers", () => {
  const plan = `### Task 1: Define config schema [no-test]

Details...

### Task 2: Implement retry logic

Details...
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks).toHaveLength(2);
  expect(tasks[0].noTest).toBe(true);
  expect(tasks[0].description).toBe("Define config schema");
  expect(tasks[1].noTest).toBe(false);
});

it("extracts [no-test] tag from numbered list items", () => {
  const plan = `## Tasks

1. Define retry config schema [no-test]
2. Implement retry logic with backoff
3. Add type definitions [no-test]
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks).toHaveLength(3);
  expect(tasks[0].noTest).toBe(true);
  expect(tasks[0].description).toBe("Define retry config schema");
  expect(tasks[1].noTest).toBe(false);
  expect(tasks[2].noTest).toBe(true);
});

it("tasks without [no-test] default to noTest: false", () => {
  const plan = `### Task 1: Regular task

Details...
`;
  const tasks = extractPlanTasks(plan);
  expect(tasks[0].noTest).toBe(false);
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/plan-parser.test.ts -v`
Expected: FAIL — `noTest` property does not exist on PlanTask

**Step 3: Add `noTest` to PlanTask and update parser**

In `extensions/megapowers/state-machine.ts`, add `noTest` to PlanTask:

```typescript
export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
  noTest: boolean;
}
```

Update `createInitialState()` — no change needed since `planTasks` starts as `[]`.

In `extensions/megapowers/plan-parser.ts`, update both extraction functions:

```typescript
function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const pattern = /^###\s+Task\s+(\d+):\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    const raw = match[2].trim();
    const noTest = /\[no-test\]/i.test(raw);
    const description = raw.replace(/\s*\[no-test\]\s*/gi, "").trim();
    tasks.push({
      index: parseInt(match[1]),
      description,
      completed: false,
      noTest,
    });
  }

  return tasks;
}

function extractNumberedItems(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      const raw = match[2].trim();
      const noTest = /\[no-test\]/i.test(raw);
      const description = raw.replace(/\s*\[no-test\]\s*/gi, "").trim();
      tasks.push({
        index: parseInt(match[1]),
        description,
        completed: false,
        noTest,
      });
    }
  }

  return tasks;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/plan-parser.test.ts -v`
Expected: ALL PASS

**Step 5: Fix any broken tests across the project**

The addition of `noTest` to PlanTask means existing test fixtures that create PlanTask objects need updating. Grep for `completed: false` and `completed: true` in test files and add `noTest: false` to each.

Run: `bun test -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add extensions/megapowers/state-machine.ts extensions/megapowers/plan-parser.ts tests/plan-parser.test.ts
git add tests/  # catch any test fixups
git commit -m "feat: add noTest field to PlanTask and parse [no-test] tag"
```

---

### Task 2: Create tdd-guard module — `isTestFile` and `isAllowlisted`

**Files:**
- Create: `extensions/megapowers/tdd-guard.ts`
- Create: `tests/tdd-guard.test.ts`

**Step 1: Write failing tests for file classification functions**

Create `tests/tdd-guard.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { isTestFile, isAllowlisted } from "../extensions/megapowers/tdd-guard.js";

describe("isTestFile", () => {
  it("matches *.test.ts files", () => {
    expect(isTestFile("src/auth.test.ts")).toBe(true);
  });

  it("matches *.spec.ts files", () => {
    expect(isTestFile("src/auth.spec.ts")).toBe(true);
  });

  it("matches *.test.js files", () => {
    expect(isTestFile("lib/utils.test.js")).toBe(true);
  });

  it("matches files in tests/ directory", () => {
    expect(isTestFile("tests/auth.ts")).toBe(true);
  });

  it("matches files in test/ directory", () => {
    expect(isTestFile("test/auth.ts")).toBe(true);
  });

  it("matches files in __tests__/ directory", () => {
    expect(isTestFile("src/__tests__/auth.ts")).toBe(true);
  });

  it("does not match regular source files", () => {
    expect(isTestFile("src/auth.ts")).toBe(false);
  });

  it("does not match files with test in the name but not the pattern", () => {
    expect(isTestFile("src/test-utils.ts")).toBe(false);
  });
});

describe("isAllowlisted", () => {
  it("allows .json files", () => {
    expect(isAllowlisted("tsconfig.json")).toBe(true);
  });

  it("allows .yaml files", () => {
    expect(isAllowlisted("config.yaml")).toBe(true);
  });

  it("allows .yml files", () => {
    expect(isAllowlisted("docker-compose.yml")).toBe(true);
  });

  it("allows .toml files", () => {
    expect(isAllowlisted("pyproject.toml")).toBe(true);
  });

  it("allows .env files", () => {
    expect(isAllowlisted(".env")).toBe(true);
    expect(isAllowlisted(".env.local")).toBe(true);
  });

  it("allows .d.ts files", () => {
    expect(isAllowlisted("src/types.d.ts")).toBe(true);
  });

  it("allows .md files", () => {
    expect(isAllowlisted("README.md")).toBe(true);
  });

  it("allows .config.* files", () => {
    expect(isAllowlisted("vite.config.ts")).toBe(true);
    expect(isAllowlisted("jest.config.js")).toBe(true);
  });

  it("does not allow regular source files", () => {
    expect(isAllowlisted("src/auth.ts")).toBe(false);
    expect(isAllowlisted("lib/utils.js")).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: FAIL — module not found

**Step 3: Implement `isTestFile` and `isAllowlisted`**

Create `extensions/megapowers/tdd-guard.ts`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/tdd-guard.ts tests/tdd-guard.test.ts
git commit -m "feat: add tdd-guard module with file classification functions"
```

---

### Task 3: Implement `isTestRunnerCommand` and `handleTestResult`

**Files:**
- Modify: `extensions/megapowers/tdd-guard.ts`
- Modify: `tests/tdd-guard.test.ts`

**Step 1: Write failing tests**

Add to `tests/tdd-guard.test.ts`:

```typescript
import { isTestFile, isAllowlisted, isTestRunnerCommand, handleTestResult, type TddState } from "../extensions/megapowers/tdd-guard.js";

describe("isTestRunnerCommand", () => {
  it("matches 'bun test'", () => {
    expect(isTestRunnerCommand("bun test")).toBe(true);
  });

  it("matches 'bun test' with arguments", () => {
    expect(isTestRunnerCommand("bun test tests/auth.test.ts -v")).toBe(true);
  });

  it("matches 'npm test'", () => {
    expect(isTestRunnerCommand("npm test")).toBe(true);
  });

  it("matches 'npx jest'", () => {
    expect(isTestRunnerCommand("npx jest")).toBe(true);
  });

  it("matches 'npx vitest'", () => {
    expect(isTestRunnerCommand("npx vitest run")).toBe(true);
  });

  it("matches 'pytest'", () => {
    expect(isTestRunnerCommand("pytest tests/")).toBe(true);
  });

  it("matches 'python -m pytest'", () => {
    expect(isTestRunnerCommand("python -m pytest")).toBe(true);
  });

  it("matches 'cargo test'", () => {
    expect(isTestRunnerCommand("cargo test")).toBe(true);
  });

  it("matches 'go test'", () => {
    expect(isTestRunnerCommand("go test ./...")).toBe(true);
  });

  it("does not match unrelated commands", () => {
    expect(isTestRunnerCommand("ls -la")).toBe(false);
    expect(isTestRunnerCommand("cat test.txt")).toBe(false);
    expect(isTestRunnerCommand("npm install")).toBe(false);
  });
});

describe("handleTestResult", () => {
  it("advances test-written to impl-allowed on non-zero exit", () => {
    expect(handleTestResult(1, "test-written")).toBe("impl-allowed");
  });

  it("stays at test-written on zero exit (tests pass = not a failing test)", () => {
    expect(handleTestResult(0, "test-written")).toBe("test-written");
  });

  it("does not change no-test state", () => {
    expect(handleTestResult(1, "no-test")).toBe("no-test");
  });

  it("does not change impl-allowed state", () => {
    expect(handleTestResult(1, "impl-allowed")).toBe("impl-allowed");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: FAIL — functions not exported

**Step 3: Implement `isTestRunnerCommand` and `handleTestResult`**

Add to `extensions/megapowers/tdd-guard.ts`:

```typescript
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

// --- State transitions ---

export function handleTestResult(exitCode: number, currentState: TddState): TddState {
  if (currentState !== "test-written") return currentState;
  if (exitCode !== 0) return "impl-allowed";
  return "test-written";
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/tdd-guard.ts tests/tdd-guard.test.ts
git commit -m "feat: add test runner detection and state transition logic"
```

---

### Task 4: Implement `checkFileWrite` — the core gating function

**Files:**
- Modify: `extensions/megapowers/tdd-guard.ts`
- Modify: `tests/tdd-guard.test.ts`

**Step 1: Write failing tests**

Add to `tests/tdd-guard.test.ts`:

```typescript
import {
  isTestFile, isAllowlisted, isTestRunnerCommand, handleTestResult,
  checkFileWrite, type TddState, type TddTaskState, type FileWriteResult,
} from "../extensions/megapowers/tdd-guard.js";
import type { PlanTask } from "../extensions/megapowers/state-machine.js";

function makeTask(overrides: Partial<PlanTask> = {}): PlanTask {
  return { index: 1, description: "Implement feature", completed: false, noTest: false, ...overrides };
}

function makeTaskState(overrides: Partial<TddTaskState> = {}): TddTaskState {
  return { taskIndex: 1, state: "no-test", skipped: false, ...overrides };
}

describe("checkFileWrite", () => {
  it("allows writes when not in implement phase", () => {
    const result = checkFileWrite("src/auth.ts", null, makeTask(), makeTaskState());
    expect(result.allow).toBe(true);
  });

  it("allows allowlisted files regardless of state", () => {
    const result = checkFileWrite("tsconfig.json", "implement", makeTask(), makeTaskState());
    expect(result.allow).toBe(true);
  });

  it("allows test file writes and advances state to test-written", () => {
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("tests/auth.test.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
    expect(result.newState).toBe("test-written");
  });

  it("allows production writes when state is impl-allowed", () => {
    const taskState = makeTaskState({ state: "impl-allowed" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
  });

  it("blocks production writes when state is no-test", () => {
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("TDD violation");
  });

  it("blocks production writes when state is test-written", () => {
    const taskState = makeTaskState({ state: "test-written" });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("TDD violation");
  });

  it("passes through when task has noTest: true", () => {
    const task = makeTask({ noTest: true });
    const taskState = makeTaskState({ state: "no-test" });
    const result = checkFileWrite("src/auth.ts", "implement", task, taskState);
    expect(result.allow).toBe(true);
  });

  it("passes through when task state is skipped", () => {
    const taskState = makeTaskState({ state: "no-test", skipped: true });
    const result = checkFileWrite("src/auth.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
  });

  it("keeps state at test-written when writing more test files", () => {
    const taskState = makeTaskState({ state: "test-written" });
    const result = checkFileWrite("tests/auth-2.test.ts", "implement", makeTask(), taskState);
    expect(result.allow).toBe(true);
    expect(result.newState).toBe("test-written");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: FAIL — `checkFileWrite` not exported

**Step 3: Implement `checkFileWrite`**

Add to `extensions/megapowers/tdd-guard.ts`:

```typescript
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

  // Test file — advance state, allow
  if (isTestFile(filePath)) {
    const newState: TddState = taskState.state === "no-test" ? "test-written" : taskState.state;
    return { allow: true, newState: newState === taskState.state ? undefined : newState };
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
```

Wait — re-reading the test: when state is `test-written` and we write another test file, we should keep `test-written`, not change it. Let me revise:

```typescript
  // Test file — advance state if needed, allow
  if (isTestFile(filePath)) {
    const newState: TddState =
      taskState.state === "no-test" ? "test-written" :
      taskState.state === "test-written" ? "test-written" :
      taskState.state;
    return { allow: true, newState: newState !== taskState.state ? newState : undefined };
  }
```

Actually simpler — test file writes always set state to at least `test-written`:

```typescript
  if (isTestFile(filePath)) {
    if (taskState.state === "no-test") {
      return { allow: true, newState: "test-written" };
    }
    return { allow: true };
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/tdd-guard.test.ts -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/tdd-guard.ts tests/tdd-guard.test.ts
git commit -m "feat: add checkFileWrite core gating function"
```

---

## Phase 2: Integration with extension

### Task 5: Add TDD state to MegapowersState and store

**Files:**
- Modify: `extensions/megapowers/state-machine.ts` (add tddTaskState to MegapowersState)
- Modify: `tests/store.test.ts` (verify persistence round-trip)

**Step 1: Write failing test**

Add to `tests/store.test.ts` inside the "state persistence" describe:

```typescript
it("persists tddTaskState through save/load", () => {
  const state = createInitialState();
  state.activeIssue = "001-test";
  state.tddTaskState = { taskIndex: 1, state: "test-written", skipped: false };

  store.saveState(state);
  const loaded = store.loadState();

  expect(loaded.tddTaskState).toEqual({ taskIndex: 1, state: "test-written", skipped: false });
});

it("defaults tddTaskState to null for legacy state", () => {
  const state = store.loadState();
  expect(state.tddTaskState).toBeNull();
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/store.test.ts -v`
Expected: FAIL — `tddTaskState` not on MegapowersState

**Step 3: Add `tddTaskState` to state**

In `extensions/megapowers/state-machine.ts`, add to `MegapowersState`:

```typescript
export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  planTasks: PlanTask[];
  jjChangeId: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  currentTaskIndex: number;
  tddTaskState: TddTaskState | null;
}
```

Import the type at the top of state-machine.ts:

```typescript
import type { TddTaskState } from "./tdd-guard.js";
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
    planTasks: [],
    jjChangeId: null,
    acceptanceCriteria: [],
    currentTaskIndex: 0,
    tddTaskState: null,
  };
}
```

**Step 4: Run all tests to verify they pass**

Run: `bun test -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/state-machine.ts tests/store.test.ts
git commit -m "feat: add tddTaskState to MegapowersState"
```

---

### Task 6: Wire tdd-guard into `tool_call` and `tool_result` events

**Files:**
- Modify: `extensions/megapowers/index.ts`

This task wires the tdd-guard pure functions into the extension's event handlers. The `tool_call` event handler checks `write` and `edit` tool calls. The `tool_result` event handler watches for bash commands that look like test runners.

**Step 1: Write failing test** [no-test]

This task is integration wiring only — the pure functions are already tested in Tasks 2-4. The correctness of the wiring will be verified by manual testing and the existing unit tests.

**Step 2: Add imports to `index.ts`**

At the top of `extensions/megapowers/index.ts`, add:

```typescript
import { checkFileWrite, isTestRunnerCommand, handleTestResult, type TddTaskState } from "./tdd-guard.js";
```

**Step 3: Add `tool_call` handler for write/edit blocking**

Add after the `pi.on("before_agent_start", ...)` block in `index.ts`:

```typescript
  // --- TDD Guard: intercept file writes ---

  pi.on("tool_call", async (event, _ctx) => {
    if (state.phase !== "implement") return;
    if (state.planTasks.length === 0) return;

    // Only gate write and edit tools
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    const currentTask = state.planTasks[state.currentTaskIndex];
    if (!currentTask) return;

    // Initialize TDD state for current task if needed
    if (!state.tddTaskState || state.tddTaskState.taskIndex !== currentTask.index) {
      state.tddTaskState = {
        taskIndex: currentTask.index,
        state: "no-test",
        skipped: false,
      };
    }

    const result = checkFileWrite(filePath, state.phase, currentTask, state.tddTaskState);

    if (result.newState && state.tddTaskState) {
      state.tddTaskState = { ...state.tddTaskState, state: result.newState };
      if (store) store.saveState(state);
    }

    if (!result.allow) {
      return { block: true, reason: result.reason };
    }
  });
```

**Step 4: Add `tool_result` handler for test runner detection**

Add after the `tool_call` handler:

```typescript
  // --- TDD Guard: detect test runner results ---

  pi.on("tool_result", async (event, _ctx) => {
    if (state.phase !== "implement") return;
    if (event.toolName !== "bash") return;
    if (!state.tddTaskState || state.tddTaskState.state !== "test-written") return;

    const command = (event.input as any)?.command;
    if (!command || !isTestRunnerCommand(command)) return;

    const details = event.details as { exitCode?: number } | undefined;
    const exitCode = details?.exitCode;
    if (exitCode === undefined) return;

    const newState = handleTestResult(exitCode, state.tddTaskState.state);
    if (newState !== state.tddTaskState.state) {
      state.tddTaskState = { ...state.tddTaskState, state: newState };
      if (store) store.saveState(state);
    }
  });
```

**Step 5: Reset TDD state on task change**

In the existing `agent_end` handler where `stateUpdate.currentTaskIndex` is set (inside the implement phase block), add TDD state reset. Find the line where `stateUpdate.currentTaskIndex = nextIndex` is applied and ensure `tddTaskState` resets:

After `state = { ...state, ...result.stateUpdate };` in the agent_end handler, add:

```typescript
    // Reset TDD state when task index changes
    if (result.stateUpdate.currentTaskIndex !== undefined &&
        result.stateUpdate.currentTaskIndex !== state.currentTaskIndex) {
      state.tddTaskState = null;
    }
```

Actually, looking at the code more carefully, the stateUpdate is applied as `state = { ...state, ...result.stateUpdate }` and then saved. The TDD state reset should happen in the `processAgentOutput` result handling. Simpler approach: just reset in the tool_call handler when task index doesn't match (already done in Step 3 above).

**Step 6: Run all tests**

Run: `bun test -v`
Expected: ALL PASS (no test changes needed — this is wiring only)

**Step 7: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat: wire tdd-guard into tool_call and tool_result events"
```

---

### Task 7: Register `/tdd skip` command

**Files:**
- Modify: `extensions/megapowers/index.ts`

**Step 1: This is a command registration** [no-test]

Commands are registered via `pi.registerCommand()` and require interactive context to test. The underlying state mutation is simple (set `skipped: true`).

**Step 2: Add the command**

Add to `index.ts` after the existing `/learn` command registration:

```typescript
  pi.registerCommand("tdd", {
    description: "TDD guard control (usage: /tdd skip | /tdd status)",
    getArgumentCompletions: (prefix) => {
      const subs = ["skip", "status"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      const sub = args.trim();

      if (sub === "skip") {
        if (state.phase !== "implement") {
          ctx.ui.notify("Not in implement phase.", "info");
          return;
        }
        if (!state.tddTaskState) {
          ctx.ui.notify("No active TDD state to skip.", "info");
          return;
        }
        state.tddTaskState = {
          ...state.tddTaskState,
          skipped: true,
          skipReason: "User-approved runtime skip",
        };
        if (store) store.saveState(state);
        ctx.ui.notify("TDD enforcement skipped for current task.", "info");
        if (ui) ui.renderDashboard(ctx, state, store);
        return;
      }

      if (sub === "status") {
        const tddInfo = state.tddTaskState
          ? `Task ${state.tddTaskState.taskIndex}: ${state.tddTaskState.state}${state.tddTaskState.skipped ? " (skipped)" : ""}`
          : "No active TDD state";
        ctx.ui.notify(`TDD Guard: ${tddInfo}\nPhase: ${state.phase ?? "none"}`, "info");
        return;
      }

      ctx.ui.notify("Usage: /tdd skip | /tdd status", "info");
    },
  });
```

**Step 3: Run all tests**

Run: `bun test -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat: add /tdd command for skip and status"
```

---

### Task 8: Add TDD state indicator to dashboard

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Step 1: Write failing tests**

Add to `tests/ui.test.ts` in a new describe block:

```typescript
describe("renderDashboardLines — TDD state indicator", () => {
  it("shows 🔴 Need test when in no-test state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toBeDefined();
    expect(tddLine).toContain("🔴");
    expect(tddLine).toContain("Need test");
  });

  it("shows 🟡 Run test when in test-written state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("🟡");
    expect(tddLine).toContain("Run test");
  });

  it("shows 🟢 Implement when in impl-allowed state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("🟢");
    expect(tddLine).toContain("Implement");
  });

  it("shows ⚪ Skipped when task is noTest", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Config schema", completed: false, noTest: true }],
      currentTaskIndex: 0,
      tddTaskState: null,
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("⚪");
    expect(tddLine).toContain("Skipped");
  });

  it("shows ⚪ Skipped when runtime skip is active", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: true },
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("⚪");
    expect(tddLine).toContain("Skipped");
  });

  it("does not show TDD indicator when not in implement phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
    };
    const lines = renderDashboardLines(state, [], plainTheme);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/ui.test.ts -v`
Expected: FAIL — no TDD line in dashboard output

**Step 3: Add TDD indicator to `renderDashboardLines`**

In `extensions/megapowers/ui.ts`, add to the `renderDashboardLines` function, after the current task display block (inside `if (state.planTasks.length > 0)`):

```typescript
    // TDD guard state indicator (implement phase only)
    if (state.phase === "implement") {
      const currentTask = state.planTasks[state.currentTaskIndex];
      let tddIndicator: string;

      if (currentTask?.noTest || state.tddTaskState?.skipped) {
        tddIndicator = "⚪ Skipped";
      } else if (!state.tddTaskState || state.tddTaskState.state === "no-test") {
        tddIndicator = "🔴 Need test";
      } else if (state.tddTaskState.state === "test-written") {
        tddIndicator = "🟡 Run test";
      } else if (state.tddTaskState.state === "impl-allowed") {
        tddIndicator = "🟢 Implement";
      } else {
        tddIndicator = "—";
      }

      lines.push(`${theme.fg("accent", "TDD:")} ${tddIndicator}`);
    }
```

Import `TddTaskState` at the top of ui.ts if needed — actually it's used via `MegapowersState.tddTaskState` so no explicit import needed.

**Step 4: Run tests to verify they pass**

Run: `bun test tests/ui.test.ts -v`
Expected: ALL PASS

**Step 5: Run all tests**

Run: `bun test -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add extensions/megapowers/ui.ts tests/ui.test.ts
git commit -m "feat: add TDD state indicator to dashboard widget"
```

---

## Checkpoint

At this point all 8 tasks are complete. The tdd-guard is fully functional:
- Pure functions tested in isolation (`tdd-guard.test.ts`)
- Plan parser parses `[no-test]` tags
- `tool_call` event blocks production writes when no failing test exists
- `tool_result` event detects test runner failures and advances state
- `/tdd skip` command for runtime bypass
- Dashboard shows TDD state indicator
- State persists across sessions

Run final verification: `bun test -v` — all tests should pass.
