# Task Coordination Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add per-task jj change tracking, satellite mode for subagent sessions, and task lifecycle management during the implement phase.

**Architecture:** Each implement-phase task gets its own jj change (child of the phase change). A new `task-coordinator.ts` module has pure helpers for building descriptions and parsing diffs, plus thin JJ wrappers for creation/inspection/abandonment/squashing. A new `satellite.ts` module detects subagent contexts and provides read-only state. The parent session orchestrates; subagent sessions enforce TDD only.

**Tech Stack:** TypeScript, Bun test, pi extension API (`ExtensionAPI`, `ExtensionContext`), jj VCS

---

## Phase 1: New Modules + State Changes

### Task 1: Add `taskJJChanges` to state and store

Add a `taskJJChanges: Record<number, string>` field to `MegapowersState` for tracking per-task jj change IDs. The store's `loadState()` already merges over `createInitialState()` defaults, so adding the field + default handles migration automatically.

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Modify: `extensions/megapowers/state-machine.ts` (add field to `MegapowersState` interface and `createInitialState()`)
- Test: `tests/store.test.ts` (add persistence + migration tests)
- Test: `tests/state-machine.test.ts` (add reset-on-implement test)

**Step 1: Run existing tests to confirm green baseline**

Run: `bun test tests/store.test.ts tests/state-machine.test.ts`
Expected: ALL PASS

**Step 2: Write the failing tests**

Add to `tests/store.test.ts` inside the `"state persistence"` describe block:

```typescript
it("persists taskJJChanges through save/load", () => {
  const state = createInitialState();
  state.activeIssue = "001-test";
  state.taskJJChanges = { 1: "abc123", 2: "def456" };

  store.saveState(state);
  const loaded = store.loadState();

  expect(loaded.taskJJChanges).toEqual({ 1: "abc123", 2: "def456" });
});

it("defaults taskJJChanges to empty object for legacy state", () => {
  const { writeFileSync, mkdirSync } = require("node:fs");
  mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  writeFileSync(join(tmp, ".megapowers", "state.json"), JSON.stringify({
    version: 1,
    activeIssue: "001-test",
    workflow: "feature",
    phase: "implement",
    phaseHistory: [],
    reviewApproved: false,
    planTasks: [],
    jjChangeId: null,
    acceptanceCriteria: [],
    currentTaskIndex: 0,
    tddTaskState: null,
    // No taskJJChanges — simulating legacy state
  }));

  const loaded = store.loadState();
  expect(loaded.taskJJChanges).toEqual({});
});
```

Add to `tests/state-machine.test.ts` inside a new describe block:

```typescript
describe("transition — taskJJChanges reset", () => {
  it("resets taskJJChanges when transitioning to implement", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "review",
      reviewApproved: true,
      taskJJChanges: { 1: "old-change", 2: "old-change-2" },
      planTasks: [
        { index: 1, description: "A", completed: false, noTest: false },
      ],
    };

    const next = transition(state, "implement");
    expect(next.taskJJChanges).toEqual({});
  });

  it("preserves taskJJChanges when transitioning to non-implement phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      taskJJChanges: { 1: "change-a" },
      planTasks: [
        { index: 1, description: "A", completed: true, noTest: false },
      ],
    };

    const next = transition(state, "verify");
    expect(next.taskJJChanges).toEqual({ 1: "change-a" });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `bun test tests/store.test.ts tests/state-machine.test.ts`
Expected: FAIL — `taskJJChanges` is not a property of `MegapowersState`

**Step 4: Write minimal implementation**

In `extensions/megapowers/state-machine.ts`, add `taskJJChanges` to the `MegapowersState` interface:

```typescript
// Add after tddTaskState field:
taskJJChanges: Record<number, string>;
```

In `createInitialState()`, add:

```typescript
// Add after tddTaskState: null,
taskJJChanges: {},
```

In the `transition()` function, add reset logic inside the existing `if (to === "implement")` block:

```typescript
if (to === "implement") {
  next.currentTaskIndex = next.planTasks.findIndex(t => !t.completed);
  if (next.currentTaskIndex === -1) next.currentTaskIndex = 0;
  next.taskJJChanges = {};  // Reset per-task changes on re-entry
}
```

**Step 5: Run tests to verify they pass**

Run: `bun test tests/store.test.ts tests/state-machine.test.ts`
Expected: PASS

**Step 6: Fix type errors across codebase**

The new required field may cause type errors in test files where `MegapowersState` objects are spread from `createInitialState()` (these are fine — `createInitialState()` provides the default). But any test that constructs a literal `MegapowersState` without `taskJJChanges` will fail type-check.

Run: `bun test`
Expected: ALL PASS (spread from `createInitialState()` covers the field everywhere)

If there are type errors in `tests/ui.test.ts` where literal states are constructed, add `taskJJChanges: {}` to those literals.

**Step 7: Commit**

```bash
git add extensions/megapowers/state-machine.ts tests/store.test.ts tests/state-machine.test.ts
git commit -m "feat: add taskJJChanges to state for per-task jj change tracking"
```

---

### Task 2: Add `taskJJChanges` reset to issue activation in `ui.ts`

Both the `new` and `list` activation paths in `handleIssueCommand` construct a new `MegapowersState` literal. Add `taskJJChanges: {}` to both.

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Modify: `extensions/megapowers/ui.ts` (two places in `handleIssueCommand`)
- Test: `tests/ui.test.ts` (add assertion)

**Step 1: Run existing tests**

Run: `bun test tests/ui.test.ts`
Expected: ALL PASS

**Step 2: Write the failing test**

Add to `tests/ui.test.ts` inside the `"handleIssueCommand — new state fields"` describe block:

```typescript
it("new issue resets taskJJChanges", async () => {
  const store = createStore(tmp);
  const ui = createUI();
  const jj = createMockJJ();
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "old-issue",
    workflow: "feature",
    phase: "implement",
    taskJJChanges: { 1: "stale-change" },
  };

  const ctx = createMockCtx();
  ctx.ui.input = async () => "New issue";
  ctx.ui.select = async (_prompt: string, items: string[]) => {
    return items.includes("feature") ? "feature" : items[0];
  };
  ctx.ui.editor = async () => "description";

  const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "new");

  expect(result.taskJJChanges).toEqual({});
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/ui.test.ts`
Expected: FAIL — `taskJJChanges` not set in the `newState` literal (it's missing from the spread, or it carries over the stale value)

**Step 4: Write minimal implementation**

In `extensions/megapowers/ui.ts`, in the `handleIssueCommand` method, add `taskJJChanges: {}` to both `newState` object literals:

In the `"new"` subcommand path (around the `const newState: MegapowersState = {` block):
```typescript
taskJJChanges: {},
```

In the `"list"` subcommand path (around the second `const newState: MegapowersState = {` block):
```typescript
taskJJChanges: {},
```

**Step 5: Run tests to verify they pass**

Run: `bun test tests/ui.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add extensions/megapowers/ui.ts tests/ui.test.ts
git commit -m "feat: reset taskJJChanges on issue activation"
```

---

### Task 3: Extend JJ interface with `diff`, `abandon`, `squashInto`

The task coordinator needs three new JJ operations. Follow the existing pattern: pure `buildXxxArgs()` functions (tested) + interface methods + `createJJ` implementation.

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Modify: `extensions/megapowers/jj.ts`
- Test: `tests/jj.test.ts`

**Step 1: Write the failing tests**

Add to `tests/jj.test.ts`:

```typescript
// Add these imports at top:
import {
  // ...existing imports...
  buildDiffArgs,
  buildAbandonArgs,
  buildSquashIntoArgs,
} from "../extensions/megapowers/jj.js";

// Add new describe blocks:

describe("buildDiffArgs", () => {
  it("builds diff --summary for a specific change", () => {
    expect(buildDiffArgs("abc123")).toEqual(["diff", "--summary", "-r", "abc123"]);
  });
});

describe("buildAbandonArgs", () => {
  it("builds abandon for a specific change", () => {
    expect(buildAbandonArgs("abc123")).toEqual(["abandon", "abc123"]);
  });
});

describe("buildSquashIntoArgs", () => {
  it("builds squash from children into parent", () => {
    expect(buildSquashIntoArgs("parentid")).toEqual([
      "squash", "--from", "all:children(parentid)", "--into", "parentid",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/jj.test.ts`
Expected: FAIL — `buildDiffArgs`, `buildAbandonArgs`, `buildSquashIntoArgs` not exported

**Step 3: Write minimal implementation**

Add to `extensions/megapowers/jj.ts` after the existing `buildLogArgs` function:

```typescript
export function buildDiffArgs(changeId: string): string[] {
  return ["diff", "--summary", "-r", changeId];
}

export function buildAbandonArgs(changeId: string): string[] {
  return ["abandon", changeId];
}

export function buildSquashIntoArgs(parentChangeId: string): string[] {
  return ["squash", "--from", `all:children(${parentChangeId})`, "--into", parentChangeId];
}
```

Add to the `JJ` interface:

```typescript
diff(changeId: string): Promise<string>;
abandon(changeId: string): Promise<void>;
squashInto(parentChangeId: string): Promise<void>;
```

Add to the `createJJ` return object:

```typescript
async diff(changeId: string): Promise<string> {
  const result = await run(buildDiffArgs(changeId));
  return result.stdout;
},

async abandon(changeId: string): Promise<void> {
  await run(buildAbandonArgs(changeId));
},

async squashInto(parentChangeId: string): Promise<void> {
  await run(buildSquashIntoArgs(parentChangeId));
},
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/jj.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/jj.ts tests/jj.test.ts
git commit -m "feat: add diff, abandon, squashInto to JJ interface"
```

---

### Task 4: Create `task-coordinator.ts` with pure helpers

Pure functions for building task change descriptions, parsing jj diff output, reporting task completion, and deciding when to create task changes. No JJ calls in this task — just testable logic.

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `extensions/megapowers/task-coordinator.ts`
- Create: `tests/task-coordinator.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/task-coordinator.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
  shouldCreateTaskChange,
} from "../extensions/megapowers/task-coordinator.js";

describe("buildTaskChangeDescription", () => {
  it("formats description with issue slug and task number", () => {
    expect(buildTaskChangeDescription("001-auth-flow", 3, "Add retry logic")).toBe(
      "mega(001-auth-flow): task-3 — Add retry logic"
    );
  });

  it("formats description for task 1", () => {
    expect(buildTaskChangeDescription("002-fix-bug", 1, "Define types")).toBe(
      "mega(002-fix-bug): task-1 — Define types"
    );
  });
});

describe("parseTaskDiffFiles", () => {
  it("extracts file paths from jj diff --summary output", () => {
    const output = `M src/auth.ts\nA tests/auth.test.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("extracts file paths from jj diff --stat output", () => {
    const output = `src/auth.ts    | 10 ++++++----\ntests/auth.test.ts |  5 +++++\n2 files changed, 11 insertions(+), 4 deletions(-)`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("returns empty array for empty diff", () => {
    expect(parseTaskDiffFiles("")).toEqual([]);
  });

  it("returns empty array for summary-only line", () => {
    expect(parseTaskDiffFiles("0 files changed")).toEqual([]);
  });
});

describe("buildTaskCompletionReport", () => {
  it("builds a report listing files when diffs exist", () => {
    const report = buildTaskCompletionReport(3, "Add retry logic", {
      files: ["src/retry.ts", "tests/retry.test.ts"],
      hasDiffs: true,
    });
    expect(report).toContain("Task 3");
    expect(report).toContain("Add retry logic");
    expect(report).toContain("src/retry.ts");
    expect(report).toContain("2 files");
  });

  it("flags warning when no diffs", () => {
    const report = buildTaskCompletionReport(1, "Define types", {
      files: [],
      hasDiffs: false,
    });
    expect(report).toContain("⚠");
    expect(report).toContain("no file changes");
  });
});

describe("shouldCreateTaskChange", () => {
  it("returns true when in implement phase with active task and no existing change", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(true);
  });

  it("returns false when task already has a change ID", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: { 1: "existing-change" },
    })).toBe(false);
  });

  it("returns false when not in implement phase", () => {
    expect(shouldCreateTaskChange({
      phase: "plan",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when no tasks exist", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when currentTaskIndex is out of bounds", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 5,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/task-coordinator.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// extensions/megapowers/task-coordinator.ts
import type { PlanTask, Phase } from "./state-machine.js";

// --- Pure helpers ---

export function buildTaskChangeDescription(
  issueSlug: string,
  taskIndex: number,
  taskDescription: string
): string {
  return `mega(${issueSlug}): task-${taskIndex} — ${taskDescription}`;
}

/**
 * Parse file paths from jj diff output.
 * Supports --summary format ("M src/auth.ts") and --stat format ("src/auth.ts | 10 ++++").
 */
export function parseTaskDiffFiles(diffOutput: string): string[] {
  if (!diffOutput.trim()) return [];

  const files: string[] = [];
  for (const line of diffOutput.split("\n")) {
    // --summary format: "M src/auth.ts" or "A tests/auth.test.ts" or "D old.ts"
    const summaryMatch = line.match(/^[MAD]\s+(.+)$/);
    if (summaryMatch) {
      files.push(summaryMatch[1].trim());
      continue;
    }
    // --stat format: "src/auth.ts    | 10 ++++++----"
    const statMatch = line.match(/^(.+?)\s+\|\s+\d+/);
    if (statMatch) {
      files.push(statMatch[1].trim());
    }
  }
  return files;
}

export interface TaskInspection {
  files: string[];
  hasDiffs: boolean;
}

export function buildTaskCompletionReport(
  taskIndex: number,
  taskDescription: string,
  inspection: TaskInspection
): string {
  if (!inspection.hasDiffs) {
    return `⚠ Task ${taskIndex} (${taskDescription}) completed with no file changes.`;
  }
  const fileList = inspection.files.map(f => `  - ${f}`).join("\n");
  return `Task ${taskIndex} (${taskDescription}) — ${inspection.files.length} files:\n${fileList}`;
}

export interface TaskChangeContext {
  phase: Phase | null;
  currentTaskIndex: number;
  planTasks: PlanTask[];
  taskJJChanges: Record<number, string>;
}

export function shouldCreateTaskChange(ctx: TaskChangeContext): boolean {
  if (ctx.phase !== "implement") return false;
  if (ctx.planTasks.length === 0) return false;
  const currentTask = ctx.planTasks[ctx.currentTaskIndex];
  if (!currentTask) return false;
  if (ctx.taskJJChanges[currentTask.index]) return false;
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/task-coordinator.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts tests/task-coordinator.test.ts
git commit -m "feat: add task-coordinator with pure helpers"
```

---

### Task 5: Add JJ wrapper functions to `task-coordinator.ts`

Add the thin async wrappers that call the JJ interface. These aren't unit-tested (they're one-liners over the JJ interface) but are needed by the wiring in `index.ts`.

**TDD scenario:** Trivial change — no test needed for one-line wrappers.

**Files:**
- Modify: `extensions/megapowers/task-coordinator.ts`

**Step 1: Add JJ wrappers**

Add to the bottom of `extensions/megapowers/task-coordinator.ts`:

```typescript
import type { JJ } from "./jj.js";

// --- JJ wrappers (thin, used by index.ts) ---

export interface TaskChangeResult {
  changeId: string | null;
}

export async function createTaskChange(
  jj: JJ,
  issueSlug: string,
  taskIndex: number,
  taskDescription: string,
  parentChangeId?: string
): Promise<TaskChangeResult> {
  const desc = buildTaskChangeDescription(issueSlug, taskIndex, taskDescription);
  const changeId = await jj.newChange(desc, parentChangeId);
  return { changeId };
}

export async function inspectTaskChange(
  jj: JJ,
  changeId: string
): Promise<TaskInspection> {
  const diffOutput = await jj.diff(changeId);
  const files = parseTaskDiffFiles(diffOutput);
  return { files, hasDiffs: files.length > 0 };
}

export async function abandonTaskChange(
  jj: JJ,
  changeId: string
): Promise<void> {
  await jj.abandon(changeId);
}

export async function squashTaskChanges(
  jj: JJ,
  phaseChangeId: string
): Promise<void> {
  await jj.squashInto(phaseChangeId);
}
```

Note: Move the `import type { JJ }` to the top of the file alongside the other imports.

**Step 2: Run tests to verify nothing broke**

Run: `bun test tests/task-coordinator.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts
git commit -m "feat: add JJ wrapper functions to task-coordinator"
```

---

### Task 6: Create `satellite.ts` — detection + read-only state

Create the satellite module with `isSatelliteMode()` (pure, injectable context for testability) and `loadSatelliteState()` (loads frozen state from store).

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `extensions/megapowers/satellite.ts`
- Create: `tests/satellite.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/satellite.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isSatelliteMode, loadSatelliteState } from "../extensions/megapowers/satellite.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { createStore } from "../extensions/megapowers/store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("isSatelliteMode", () => {
  it("returns false when TTY is attached and no subagent signal", () => {
    expect(isSatelliteMode({ isTTY: true, env: {} })).toBe(false);
  });

  it("returns true when PI_SUBAGENT=1", () => {
    expect(isSatelliteMode({ isTTY: true, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("returns true when no TTY attached (isTTY is false)", () => {
    expect(isSatelliteMode({ isTTY: false, env: {} })).toBe(true);
  });

  it("returns false when isTTY is undefined (ambiguous — not satellite)", () => {
    expect(isSatelliteMode({ isTTY: undefined, env: {} })).toBe(false);
  });
});

describe("loadSatelliteState", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-satellite-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns frozen state from store", () => {
    const store = createStore(tmp);
    const state = createInitialState();
    state.activeIssue = "001-test";
    state.phase = "implement";
    store.saveState(state);

    const loaded = loadSatelliteState(tmp);
    expect(loaded.activeIssue).toBe("001-test");
    expect(loaded.phase).toBe("implement");
    expect(() => { (loaded as any).phase = "plan"; }).toThrow();
  });

  it("returns frozen initial state when no state file exists", () => {
    const loaded = loadSatelliteState(tmp);
    expect(loaded.activeIssue).toBeNull();
    expect(() => { (loaded as any).phase = "plan"; }).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/satellite.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// extensions/megapowers/satellite.ts
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
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/satellite.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/satellite.ts tests/satellite.test.ts
git commit -m "feat: add satellite mode detection and read-only state loading"
```

---

## Phase 2: Wiring

### Task 7: Wire task change creation in `index.ts` `before_agent_start`

When the implement phase starts a task and no jj change exists for it yet, create one. Uses the `shouldCreateTaskChange` guard + `createTaskChange` wrapper.

**TDD scenario:** Modifying tested code — the wiring touches `index.ts` which has no direct unit tests (it's integration). The pure logic is already tested in task-coordinator. Run full suite to catch regressions.

**Files:**
- Modify: `extensions/megapowers/index.ts`

**Step 1: Add imports**

Add at the top of `extensions/megapowers/index.ts`:

```typescript
import { shouldCreateTaskChange, createTaskChange, inspectTaskChange, buildTaskCompletionReport } from "./task-coordinator.js";
```

**Step 2: Add task change creation in `before_agent_start`**

In the `before_agent_start` handler, after the existing implement-phase `buildImplementTaskVars` block (which ends around `Object.assign(vars, buildImplementTaskVars(...))`), add:

```typescript
// Create per-task jj change if needed
if (state.phase === "implement" && state.planTasks.length > 0 && await jj.isJJRepo()) {
  if (shouldCreateTaskChange(state)) {
    const task = state.planTasks[state.currentTaskIndex];
    const result = await createTaskChange(
      jj,
      state.activeIssue!,
      task.index,
      task.description,
      state.jjChangeId ?? undefined
    );
    if (result.changeId) {
      state = { ...state, taskJJChanges: { ...state.taskJJChanges, [task.index]: result.changeId } };
      store.saveState(state);
    }
  }
}
```

**Step 3: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat: wire task change creation on implement phase task start"
```

---

### Task 8: Wire task inspection in `index.ts` `agent_end`

When a task is completed during the implement phase, inspect its jj change and report which files were modified.

**TDD scenario:** Trivial wiring — pure logic already tested in task-coordinator.

**Files:**
- Modify: `extensions/megapowers/index.ts`

**Step 1: Add task inspection after task completion**

In the `agent_end` handler, after the existing block that applies `result.stateUpdate` and before the notifications loop, add:

```typescript
// Inspect jj change for completed task
if (phase === "implement" && result.stateUpdate.planTasks) {
  // A task was just completed — the previous currentTaskIndex was the completed one
  const prevTaskIndex = state.currentTaskIndex;
  const prevState = { ...state };
  // Apply state update first to get new state
  const updatedState = { ...state, ...result.stateUpdate };
  
  const completedTask = prevState.planTasks[prevTaskIndex];
  const changeId = prevState.taskJJChanges[completedTask?.index];
  if (changeId && completedTask && await jj.isJJRepo()) {
    try {
      const inspection = await inspectTaskChange(jj, changeId);
      const report = buildTaskCompletionReport(completedTask.index, completedTask.description, inspection);
      result.notifications.push(report);
    } catch {
      // jj inspection is best-effort — don't block completion
    }
  }
}
```

Important: This block must come **after** `result.stateUpdate` is computed by `processAgentOutput` but **before** the state is actually applied to the `state` variable. Look at the current flow — `result` is returned from `processAgentOutput`, then artifacts are applied, then `state = { ...state, ...result.stateUpdate }`. Insert this inspection block between `processAgentOutput` and the state application.

**Step 2: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat: inspect jj change on task completion and report"
```

---

### Task 9: Wire satellite mode early return in `index.ts`

When the extension loads in a subagent session, skip all commands/dashboard/prompt injection and only register the TDD guard `tool_call` hook (read-only).

**TDD scenario:** Trivial wiring — satellite detection is tested in satellite.test.ts, TDD guard logic is tested in tdd-guard.test.ts.

**Files:**
- Modify: `extensions/megapowers/index.ts`

**Step 1: Add satellite imports**

Add at the top of `extensions/megapowers/index.ts`:

```typescript
import { isSatelliteMode, loadSatelliteState } from "./satellite.js";
```

**Step 2: Add satellite early return**

At the very start of the `megapowers` function body (before `let state`, `let store`, etc.), add:

```typescript
// --- Satellite mode: TDD-only for subagent sessions ---
const satellite = isSatelliteMode({
  isTTY: process.stdout.isTTY,
  env: process.env as Record<string, string | undefined>,
});

if (satellite) {
  let satelliteState: Readonly<MegapowersState> | null = null;

  pi.on("session_start", async (_event, ctx) => {
    satelliteState = loadSatelliteState(ctx.cwd);
  });

  pi.on("tool_call", async (event, _ctx) => {
    if (!satelliteState || satelliteState.phase !== "implement") return;
    if (satelliteState.planTasks.length === 0) return;

    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    const currentTask = satelliteState.planTasks[satelliteState.currentTaskIndex];
    if (!currentTask) return;

    const tddState = satelliteState.tddTaskState ?? {
      taskIndex: currentTask.index,
      state: "no-test" as const,
      skipped: false,
    };

    const result = checkFileWrite(filePath, satelliteState.phase, currentTask, tddState);

    if (!result.allow) {
      return { block: true, reason: result.reason };
    }
  });

  return; // Skip all primary session setup
}
```

**Step 3: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add extensions/megapowers/index.ts
git commit -m "feat: wire satellite mode — TDD-only for subagent sessions"
```

---

### Task 10: Add squash option to done phase menu in `ui.ts`

When there are per-task jj changes, offer a "Squash task changes" option in the done phase wrap-up menu.

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Step 1: Run existing tests**

Run: `bun test tests/ui.test.ts`
Expected: ALL PASS

**Step 2: Write the failing test**

Add to `tests/ui.test.ts`. First update `createMockJJ` to include the new methods:

```typescript
// Update the existing createMockJJ function:
function createMockJJ() {
  return {
    isJJRepo: async () => false,
    describe: async () => {},
    newChange: async () => null,
    log: async () => "",
    diff: async () => "",
    abandon: async () => {},
    squashInto: async () => {},
  };
}
```

Then add new tests inside the `"handleDonePhase"` describe block:

```typescript
it("offers squash option when taskJJChanges exist", async () => {
  const store = createStore(tmp);
  const ui = createUI();
  const jj = createMockJJ();
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
    taskJJChanges: { 1: "abc123", 2: "def456" },
    jjChangeId: "phase-change-id",
  };

  let selectItems: string[] = [];
  const ctx = createMockCtx();
  ctx.ui.select = async (_prompt: string, items: string[]) => {
    selectItems = items;
    return "Done — finish without further actions";
  };

  await ui.handleDonePhase(ctx as any, state, store, jj as any);

  expect(selectItems.some(item => item.toLowerCase().includes("squash"))).toBe(true);
});

it("does not offer squash option when no taskJJChanges", async () => {
  const store = createStore(tmp);
  const ui = createUI();
  const jj = createMockJJ();
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
    taskJJChanges: {},
  };

  let selectItems: string[] = [];
  const ctx = createMockCtx();
  ctx.ui.select = async (_prompt: string, items: string[]) => {
    selectItems = items;
    return "Done — finish without further actions";
  };

  await ui.handleDonePhase(ctx as any, state, store, jj as any);

  expect(selectItems.every(item => !item.toLowerCase().includes("squash"))).toBe(true);
});

it("squashes task changes and clears taskJJChanges", async () => {
  const store = createStore(tmp);
  const ui = createUI();
  let squashedInto: string | null = null;
  const jj = {
    ...createMockJJ(),
    squashInto: async (id: string) => { squashedInto = id; },
  };
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
    taskJJChanges: { 1: "abc123" },
    jjChangeId: "phase-change-id",
  };

  let callCount = 0;
  const ctx = createMockCtx();
  ctx.ui.select = async (_prompt: string, _items: string[]) => {
    callCount++;
    if (callCount === 1) return "Squash task changes into phase change";
    return "Done — finish without further actions";
  };

  const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);

  expect(squashedInto).toBe("phase-change-id");
  expect(result.taskJJChanges).toEqual({});
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/ui.test.ts`
Expected: FAIL — squash option not offered / not handled

**Step 4: Write minimal implementation**

In `extensions/megapowers/ui.ts`, modify the `handleDonePhase` method. Replace the static `actions` array with dynamic construction:

```typescript
async handleDonePhase(ctx, state, store, jj) {
  if (!state.activeIssue) return state;

  const actions = [
    "Close issue",
    "Generate commit message",
    "Update docs (LLM generates from artifacts)",
    "Write changelog entry",
  ];

  // Offer squash if there are per-task jj changes
  const hasTaskChanges = Object.keys(state.taskJJChanges).length > 0 && state.jjChangeId;
  if (hasTaskChanges) {
    actions.push("Squash task changes into phase change");
  }

  actions.push("Done — finish without further actions");

  let continueMenu = true;
  let newState = state;

  while (continueMenu) {
    const choice = await ctx.ui.select("Wrap-up actions:", actions);
    if (!choice || choice.startsWith("Done")) {
      continueMenu = false;
      break;
    }

    if (choice === "Close issue") {
      store.updateIssueStatus(state.activeIssue, "done");
      newState = createInitialState();
      store.saveState(newState);
      ctx.ui.notify("Issue closed.", "info");
      continueMenu = false;
      break;
    }

    if (choice === "Squash task changes into phase change") {
      if (state.jjChangeId) {
        await jj.squashInto(state.jjChangeId);
        newState = { ...newState, taskJJChanges: {} };
        ctx.ui.notify("Task changes squashed into phase change.", "info");
      }
    }

    if (choice.startsWith("Generate commit")) {
      ctx.ui.notify("Ask the LLM to generate a commit message based on the spec and changes.", "info");
    }

    if (choice.startsWith("Update docs")) {
      ctx.ui.notify("Ask the LLM to generate/update docs. The done-phase prompt will guide it.", "info");
    }

    if (choice.startsWith("Write changelog")) {
      ctx.ui.notify("Ask the LLM to write a changelog entry. The done-phase prompt will guide it.", "info");
    }
  }

  return newState;
},
```

Note: You need to add the `createInitialState` import if not already present. Check — it's already imported at the top of `ui.ts`.

**Step 5: Run tests to verify they pass**

Run: `bun test tests/ui.test.ts`
Expected: ALL PASS

**Step 6: Run full suite**

Run: `bun test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add extensions/megapowers/ui.ts tests/ui.test.ts
git commit -m "feat: add squash task changes option to done phase menu"
```

---

### Task 11: Update implement-task prompt with subagent guidance [no-test]

Add execution mode guidance to the implement-task prompt.

**TDD scenario:** Trivial change — markdown only, no test needed.

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1: Edit the prompt**

Add the following section after the `## Context` heading and before `## Current Task`:

```markdown
## Execution Mode
You may work on this task inline or delegate to a subagent tool (if available).
- **Inline:** Work directly in this session. TDD is enforced via tdd-guard.
- **Subagent:** Delegate the task. TDD is enforced in the subagent's satellite session.
- Either way, signal task completion when done so megapowers can inspect and advance.
```

**Step 2: Commit**

```bash
git add prompts/implement-task.md
git commit -m "docs: add subagent execution guidance to implement-task prompt"
```

---

## Checkpoint

All components are implemented and wired:

- ✅ `state-machine.ts` — `taskJJChanges` field + reset on implement entry
- ✅ `store.ts` — persistence + migration (via `createInitialState()` merge)
- ✅ `jj.ts` — `diff`, `abandon`, `squashInto` methods
- ✅ `task-coordinator.ts` — pure helpers + JJ wrappers
- ✅ `satellite.ts` — detection + read-only state
- ✅ `index.ts` — satellite early return + task change creation + task inspection
- ✅ `ui.ts` — squash option in done menu + `taskJJChanges` reset on issue activation
- ✅ `implement-task.md` — subagent guidance

Run the full test suite to confirm:

```bash
bun test
```

All tests should pass.
