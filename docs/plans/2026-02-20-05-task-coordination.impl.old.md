# Task Coordination Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add distributed task coordination — per-task jj changes, satellite mode for subagent sessions, and task lifecycle management in the implement phase.

**Architecture:** Each implement-phase task gets its own jj change (child of the phase change). A new `task-coordinator.ts` module manages creation, inspection, abandonment, and squashing of these changes. A new `satellite.ts` module detects subagent contexts and restricts the extension to TDD-guard-only mode. The parent session orchestrates task changes while subagent sessions run as read-only satellites.

**Tech Stack:** TypeScript, Bun test, pi extension API (`ExtensionAPI`, `ExtensionContext`), jj VCS

---

## Phase 1: Task Coordinator Module

### Task 1: Satellite detection [no-test]

Create `satellite.ts` with `isSatelliteMode()` — a pure function that checks environment signals.

**Files:**
- Create: `extensions/megapowers/satellite.ts`
- Test: `tests/satellite.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/satellite.test.ts
import { describe, it, expect, afterEach } from "bun:test";
import { isSatelliteMode } from "../extensions/megapowers/satellite.js";

// Save originals for cleanup
const origEnv = { ...process.env };
const origIsTTY = process.stdout.isTTY;

afterEach(() => {
  // Restore env
  delete process.env.PI_SUBAGENT;
  process.stdout.isTTY = origIsTTY;
});

describe("isSatelliteMode", () => {
  it("returns false when TTY is attached and no subagent signal", () => {
    delete process.env.PI_SUBAGENT;
    // Can't reliably mock isTTY in bun, so test the env-based path
    process.env.PI_SUBAGENT = "";
    // If we're running in a TTY (test runner), this should be false
    // We test the override path below
    expect(isSatelliteMode({ isTTY: true, env: {} })).toBe(false);
  });

  it("returns true when PI_SUBAGENT=1", () => {
    expect(isSatelliteMode({ isTTY: true, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });

  it("returns true when no TTY attached", () => {
    expect(isSatelliteMode({ isTTY: false, env: {} })).toBe(true);
  });

  it("returns true when isTTY is undefined (piped)", () => {
    expect(isSatelliteMode({ isTTY: undefined, env: {} })).toBe(false);
    // undefined isTTY means not a TTY → satellite
    expect(isSatelliteMode({ isTTY: undefined as any, env: {} })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/satellite.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// extensions/megapowers/satellite.ts

export interface SatelliteDetectionContext {
  isTTY: boolean | undefined;
  env: Record<string, string | undefined>;
}

/**
 * Detect if the current session is running as a satellite (subagent).
 *
 * A session is satellite if:
 * - PI_SUBAGENT=1 is set in environment
 * - No TTY is attached (isTTY is false)
 *
 * Pass context explicitly for testability. For real usage:
 *   isSatelliteMode({ isTTY: process.stdout.isTTY, env: process.env })
 */
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  if (ctx.env.PI_SUBAGENT === "1") return true;
  if (ctx.isTTY === false) return true;
  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/satellite.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/satellite.ts tests/satellite.test.ts
git commit -m "feat: add satellite mode detection"
```

---

### Task 2: Task coordinator — createTaskChange and inspectTaskChange

Create `task-coordinator.ts` with functions that wrap jj operations for per-task change management. These are pure builders + thin wrappers over the `JJ` interface.

**Files:**
- Create: `extensions/megapowers/task-coordinator.ts`
- Test: `tests/task-coordinator.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/task-coordinator.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
} from "../extensions/megapowers/task-coordinator.js";

describe("buildTaskChangeDescription", () => {
  it("formats description with issue slug and task name", () => {
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
  it("extracts file paths from jj diff --stat output", () => {
    const output = `src/auth.ts    | 10 ++++++----
tests/auth.test.ts |  5 +++++
2 files changed, 11 insertions(+), 4 deletions(-)`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("returns empty array for empty diff", () => {
    expect(parseTaskDiffFiles("")).toEqual([]);
    expect(parseTaskDiffFiles("0 files changed")).toEqual([]);
  });

  it("extracts file paths from jj diff --summary output", () => {
    const output = `M src/auth.ts
A tests/auth.test.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/task-coordinator.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// extensions/megapowers/task-coordinator.ts
import type { JJ } from "./jj.js";

// --- Pure functions (testable without JJ) ---

export function buildTaskChangeDescription(
  issueSlug: string,
  taskIndex: number,
  taskDescription: string
): string {
  return `mega(${issueSlug}): task-${taskIndex} — ${taskDescription}`;
}

/**
 * Parse file paths from jj diff output.
 * Supports both --stat format and --summary format.
 */
export function parseTaskDiffFiles(diffOutput: string): string[] {
  if (!diffOutput.trim()) return [];

  const files: string[] = [];

  for (const line of diffOutput.split("\n")) {
    // --summary format: "M src/auth.ts" or "A tests/auth.test.ts"
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

// --- JJ wrappers (used by index.ts) ---

export interface TaskChangeResult {
  changeId: string | null;
}

export interface TaskInspection {
  files: string[];
  hasDiffs: boolean;
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
  // Use jj diff with --summary for the change
  // The JJ interface doesn't have a diff method yet — we use log as a proxy
  // For now, we'll need to add a diff method to JJ interface
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
  // Squash all children of the phase change into it
  await jj.squashInto(phaseChangeId);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/task-coordinator.test.ts`
Expected: PASS (pure function tests pass; the JJ wrappers aren't tested here)

**Step 5: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts tests/task-coordinator.test.ts
git commit -m "feat: add task-coordinator with pure builders and jj wrappers"
```

---

### Task 3: Extend JJ interface with diff, abandon, squashInto

The task-coordinator needs `diff`, `abandon`, and `squashInto` on the `JJ` interface. Add these methods.

**Files:**
- Modify: `extensions/megapowers/jj.ts`
- Test: `tests/jj.test.ts`

**Step 1: Write the failing test**

Add to `tests/jj.test.ts`:

```typescript
// Add these imports at top if not already present
import {
  // ...existing imports...
  buildDiffArgs,
  buildAbandonArgs,
  buildSquashIntoArgs,
} from "../extensions/megapowers/jj.js";

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
Expected: FAIL — buildDiffArgs, buildAbandonArgs, buildSquashIntoArgs not exported

**Step 3: Write minimal implementation**

Add to `extensions/megapowers/jj.ts`:

After the existing `buildLogArgs` function, add:

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
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/jj.ts tests/jj.test.ts
git commit -m "feat: add diff, abandon, squashInto to JJ interface"
```

---

### Task 4: Add taskJJChanges to state and store

Track per-task jj change IDs in `MegapowersState`. The state needs a map from task index to jj change ID.

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Modify: `extensions/megapowers/store.ts`
- Test: `tests/store.test.ts`

**Step 1: Write the failing test**

Add to `tests/store.test.ts`:

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

**Step 2: Run test to verify it fails**

Run: `bun test tests/store.test.ts`
Expected: FAIL — `taskJJChanges` not a property of `MegapowersState`

**Step 3: Write minimal implementation**

In `extensions/megapowers/state-machine.ts`, add to `MegapowersState` interface:

```typescript
taskJJChanges: Record<number, string>;
```

In `createInitialState()`, add:

```typescript
taskJJChanges: {},
```

In `extensions/megapowers/store.ts`, in the `loadState()` method, the existing merge logic `{ ...createInitialState(), ...raw }` will handle backfilling the new field automatically since `createInitialState()` provides the default. No additional code needed there.

Also update `ui.ts` `handleIssueCommand` — both the `new` and `list` activation paths reset state. Add `taskJJChanges: {}` alongside the other resets.

**Step 4: Run test to verify it passes**

Run: `bun test tests/store.test.ts`
Expected: PASS

Also run the full suite to catch type errors:

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/state-machine.ts extensions/megapowers/store.ts extensions/megapowers/ui.ts tests/store.test.ts
git commit -m "feat: add taskJJChanges to state for per-task jj change tracking"
```

---

## Phase 2: Wire Coordination Into Index

### Task 5: Wire task change creation on task start

When the implement phase advances to a new task, create a jj change for it. This happens in `index.ts` in the `before_agent_start` hook (or after task completion).

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/task-coordinator.test.ts`

**Step 1: Write the failing test**

Add an integration-style test for the task setup logic as a pure function:

```typescript
// Add to tests/task-coordinator.test.ts

import { shouldCreateTaskChange } from "../extensions/megapowers/task-coordinator.js";

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
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/task-coordinator.test.ts`
Expected: FAIL — `shouldCreateTaskChange` not exported

**Step 3: Write minimal implementation**

Add to `extensions/megapowers/task-coordinator.ts`:

```typescript
import type { PlanTask, Phase } from "./state-machine.js";

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

Then wire it in `extensions/megapowers/index.ts`. In the `before_agent_start` hook, after the existing implement-phase prompt injection, add task change creation:

```typescript
// After building vars and prompt in before_agent_start:
if (state.phase === "implement" && state.planTasks.length > 0 && await jj.isJJRepo()) {
  if (shouldCreateTaskChange(state)) {
    const task = state.planTasks[state.currentTaskIndex];
    const result = await createTaskChange(jj, state.activeIssue!, task.index, task.description, state.jjChangeId ?? undefined);
    if (result.changeId) {
      state.taskJJChanges = { ...state.taskJJChanges, [task.index]: result.changeId };
      store.saveState(state);
    }
  }
}
```

Add the imports at top of `index.ts`:

```typescript
import { shouldCreateTaskChange, createTaskChange, inspectTaskChange } from "./task-coordinator.js";
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/task-coordinator.test.ts`
Expected: PASS

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts extensions/megapowers/index.ts tests/task-coordinator.test.ts
git commit -m "feat: wire task change creation on implement phase task start"
```

---

### Task 6: Wire task inspection on task completion

When `agent_end` detects task completion (the existing logic in `processAgentOutput`), inspect the jj change for that task.

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/task-coordinator.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/task-coordinator.test.ts

import { buildTaskCompletionReport } from "../extensions/megapowers/task-coordinator.js";

describe("buildTaskCompletionReport", () => {
  it("builds a report with files when diffs exist", () => {
    const report = buildTaskCompletionReport(3, "Add retry logic", {
      files: ["src/retry.ts", "tests/retry.test.ts"],
      hasDiffs: true,
    });
    expect(report).toContain("Task 3");
    expect(report).toContain("Add retry logic");
    expect(report).toContain("src/retry.ts");
    expect(report).toContain("2 files");
  });

  it("flags empty task when no diffs", () => {
    const report = buildTaskCompletionReport(1, "Define types", {
      files: [],
      hasDiffs: false,
    });
    expect(report).toContain("⚠");
    expect(report).toContain("no file changes");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/task-coordinator.test.ts`
Expected: FAIL — `buildTaskCompletionReport` not exported

**Step 3: Write minimal implementation**

Add to `extensions/megapowers/task-coordinator.ts`:

```typescript
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
```

Then wire in `index.ts` in the `agent_end` handler. After the existing task completion logic (where `stateUpdate.planTasks` is set), add inspection:

```typescript
// Inside agent_end, after applying stateUpdate and before notifications:
if (phase === "implement" && result.stateUpdate.planTasks) {
  // A task was just completed — inspect its jj change
  const completedTaskIndex = state.currentTaskIndex;
  const completedTask = state.planTasks[completedTaskIndex];
  const changeId = state.taskJJChanges[completedTask?.index];
  if (changeId && completedTask && await jj.isJJRepo()) {
    const inspection = await inspectTaskChange(jj, changeId);
    const report = buildTaskCompletionReport(completedTask.index, completedTask.description, inspection);
    result.notifications.push(report);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/task-coordinator.test.ts`
Expected: PASS

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts extensions/megapowers/index.ts tests/task-coordinator.test.ts
git commit -m "feat: inspect jj change on task completion and report"
```

---

### Task 7: Squash task changes in done phase menu

Add a "Squash task changes" option to the done phase menu in `ui.ts`.

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1: Write the failing test**

Add to `tests/ui.test.ts`:

```typescript
describe("handleDonePhase — squash option", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-squash-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("offers squash option when taskJJChanges exist", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    jj.isJJRepo = async () => true;
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

    expect(selectItems.some(item => item.toLowerCase().includes("squash"))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ui.test.ts`
Expected: FAIL — `taskJJChanges` not in mock state or squash option missing

**Step 3: Write minimal implementation**

In `extensions/megapowers/ui.ts`, in the `handleDonePhase` method, modify the `actions` array to be dynamic:

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

  // ... rest of the while loop stays the same, add handler:
  if (choice === "Squash task changes into phase change") {
    if (state.jjChangeId) {
      await jj.squashInto(state.jjChangeId);
      newState = { ...newState, taskJJChanges: {} };
      ctx.ui.notify("Task changes squashed into phase change.", "info");
    }
  }
}
```

Also update `createMockJJ()` in the test file to include the new methods:

```typescript
function createMockJJ() {
  return {
    isJJRepo: async () => false,
    describe: async () => {},
    newChange: async () => null,
    log: async () => "",
    diff: async () => "",
    abandon: async () => {},
    squashInto: async () => {},
    // ... existing methods
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ui.test.ts`
Expected: PASS

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/ui.ts tests/ui.test.ts
git commit -m "feat: add squash task changes option to done phase menu"
```

---

## Phase 3: Satellite Mode Wiring

### Task 8: Wire satellite mode in index.ts

When `isSatelliteMode()` is true, register only the TDD guard hooks (`tool_call` and `tool_result`) and skip everything else — no commands, no dashboard, no state writes, no prompt injection, no jj management.

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: Manual (satellite mode is an integration concern — the pure detection is tested in Task 1)

**Step 1: Write the failing test**

Since satellite wiring is about event hook registration (side effects on the `pi` ExtensionAPI), and the pure detection is already tested, write a test for the satellite state loading behavior:

```typescript
// Add to tests/satellite.test.ts

import { loadSatelliteState } from "../extensions/megapowers/satellite.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { createStore } from "../extensions/megapowers/store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

    // Frozen — can't mutate
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
Expected: FAIL — `loadSatelliteState` not exported

**Step 3: Write minimal implementation**

Add to `extensions/megapowers/satellite.ts`:

```typescript
import { createStore } from "./store.js";
import type { MegapowersState } from "./state-machine.js";

export function loadSatelliteState(projectRoot: string): Readonly<MegapowersState> {
  const store = createStore(projectRoot);
  const state = store.loadState();
  return Object.freeze(state);
}
```

Then modify `extensions/megapowers/index.ts` to check satellite mode at the top of the extension function:

```typescript
import { isSatelliteMode, loadSatelliteState } from "./satellite.js";

export default function megapowers(pi: ExtensionAPI): void {
  // --- Satellite mode: register only TDD guard ---
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    // Read-only state for TDD enforcement only
    let satelliteState: Readonly<MegapowersState> | null = null;

    pi.on("session_start", async (_event, ctx) => {
      satelliteState = loadSatelliteState(ctx.cwd);
    });

    // TDD guard: tool_call (same logic as primary, but read-only state)
    pi.on("tool_call", async (event, _ctx) => {
      if (!satelliteState || satelliteState.phase !== "implement") return;
      if (satelliteState.planTasks.length === 0) return;

      const toolName = event.toolName;
      if (toolName !== "write" && toolName !== "edit") return;

      const filePath: string | undefined = (event.input as any)?.path;
      if (!filePath) return;

      const currentTask = satelliteState.planTasks[satelliteState.currentTaskIndex];
      if (!currentTask) return;

      // Use the persisted TDD state (read-only)
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

    // No tool_result handler in satellite — can't write state to advance TDD
    // No commands, no dashboard, no prompt injection
    return;
  }

  // --- Primary session (existing code below) ---
  // ... rest of existing extension unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/satellite.test.ts`
Expected: PASS

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/satellite.ts extensions/megapowers/index.ts tests/satellite.test.ts
git commit -m "feat: wire satellite mode — TDD-only for subagent sessions"
```

---

### Task 9: Update implement-task prompt with subagent guidance [no-test]

Add guidance to the implement-task prompt about inline vs. subagent execution. This is a markdown-only change.

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1: Edit the prompt file**

Add the following section after the "## Context" section and before "## Current Task":

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

### Task 10: Reset taskJJChanges on issue activation and phase transitions [no-test]

Ensure `taskJJChanges` is properly reset when activating a new issue or re-entering implement phase (going back from verify).

**Files:**
- Modify: `extensions/megapowers/ui.ts` — already handled in Task 4 for issue activation
- Modify: `extensions/megapowers/state-machine.ts` — reset on transition to implement

**Step 1: Write the failing test**

Add to `tests/state-machine.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/state-machine.test.ts`
Expected: FAIL — taskJJChanges not reset

**Step 3: Write minimal implementation**

In `extensions/megapowers/state-machine.ts`, in the `transition` function, after the existing `if (to === "implement")` block, add:

```typescript
if (to === "implement") {
  next.currentTaskIndex = next.planTasks.findIndex(t => !t.completed);
  if (next.currentTaskIndex === -1) next.currentTaskIndex = 0;
  next.taskJJChanges = {};  // ← add this line
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/state-machine.test.ts`
Expected: PASS

Run: `bun test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add extensions/megapowers/state-machine.ts tests/state-machine.test.ts
git commit -m "feat: reset taskJJChanges on implement phase entry"
```

---

## Checkpoint

At this point all components are implemented and wired:
- ✅ `satellite.ts` — detection + read-only state
- ✅ `task-coordinator.ts` — per-task jj change lifecycle
- ✅ `jj.ts` — diff, abandon, squashInto
- ✅ `state-machine.ts` — taskJJChanges field + reset
- ✅ `store.ts` — persistence + migration
- ✅ `ui.ts` — squash option in done menu
- ✅ `index.ts` — satellite wiring + task change creation/inspection
- ✅ `implement-task.md` — subagent guidance

Run the full test suite to confirm:

```bash
bun test
```

All tests should pass. Review the jj change DAG to verify the structure matches the design doc's expected shape.
