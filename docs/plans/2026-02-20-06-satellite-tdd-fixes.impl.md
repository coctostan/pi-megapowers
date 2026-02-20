📌 Current branch: `feat/task-coordination`
# Satellite TDD & Review Fixes Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Fix three issues found in final code review: satellite TDD state not progressing (critical), satellite detection too broad (important), and diff parser not defensive against future jj output changes (important).

**Architecture:** Task 1-2 fix the critical satellite TDD issue by adding mutable TDD state tracking and a `tool_result` hook to the satellite early-return block in `index.ts`. Task 3 tightens satellite detection in `satellite.ts` to require `PI_SUBAGENT=1`. Task 4 broadens the diff parser regex in `task-coordinator.ts`.

**Tech Stack:** TypeScript, Bun test, pi extension API (`ExtensionAPI`, `ExtensionContext`)

---

## Task 1: Add mutable TDD state tracking to satellite `tool_call` hook

The satellite `tool_call` hook currently calls `checkFileWrite()` but ignores `result.newState`, so TDD state never progresses from `no-test` → `test-written`. Fix by maintaining mutable TDD state in the satellite block.

**TDD scenario:** Modifying tested code — run existing tests first. The satellite wiring in `index.ts` has no direct unit tests, but the pure logic (`checkFileWrite`) is tested. We need a new integration-style test in `satellite.test.ts` that exercises the state progression logic we're extracting.

**Files:**
- Create: `extensions/megapowers/satellite-tdd.ts` (extract satellite TDD logic into testable functions)
- Create: `tests/satellite-tdd.test.ts`
- Modify: `extensions/megapowers/index.ts` (use extracted functions)

**Step 1: Run existing tests to confirm green baseline**

Run: `bun test`
Expected: ALL PASS (234)

**Step 2: Write the failing tests**

Create `tests/satellite-tdd.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  createSatelliteTddState,
  handleSatelliteToolCall,
} from "../extensions/megapowers/satellite-tdd.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";

function makeImplementState(overrides: Partial<MegapowersState> = {}): Readonly<MegapowersState> {
  return Object.freeze({
    ...createInitialState(),
    activeIssue: "001-test",
    phase: "implement" as const,
    planTasks: [{ index: 1, description: "Add feature", completed: false, noTest: false }],
    currentTaskIndex: 0,
    ...overrides,
  });
}

describe("createSatelliteTddState", () => {
  it("initializes from parent tddTaskState when present", () => {
    const state = makeImplementState({
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toEqual({ taskIndex: 1, state: "test-written", skipped: false });
  });

  it("creates default no-test state when parent has no tddTaskState", () => {
    const state = makeImplementState({ tddTaskState: null });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toEqual({ taskIndex: 1, state: "no-test", skipped: false });
  });

  it("returns null when not in implement phase", () => {
    const state = makeImplementState({ phase: "plan" as any });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toBeNull();
  });

  it("returns null when no tasks", () => {
    const state = makeImplementState({ planTasks: [] });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toBeNull();
  });
});

describe("handleSatelliteToolCall", () => {
  it("returns null for non-write/edit tools", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    const result = handleSatelliteToolCall("bash", undefined, state, tdd);
    expect(result).toBeNull();
  });

  it("allows test file writes and advances state to test-written", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    expect(tdd.state).toBe("no-test");

    const result = handleSatelliteToolCall("write", "tests/feature.test.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(false);
    expect(tdd.state).toBe("test-written");
  });

  it("blocks production file writes when state is no-test", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;

    const result = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("TDD");
  });

  it("blocks production file writes when state is test-written", () => {
    const state = makeImplementState();
    const tdd = { ...createSatelliteTddState(state)!, state: "test-written" as const };

    const result = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
  });

  it("allows production file writes when state is impl-allowed", () => {
    const state = makeImplementState();
    const tdd = { ...createSatelliteTddState(state)!, state: "impl-allowed" as const };

    const result = handleSatelliteToolCall("edit", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(false);
  });

  it("returns null when no filePath provided", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    const result = handleSatelliteToolCall("write", undefined, state, tdd);
    expect(result).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/satellite-tdd.test.ts`
Expected: FAIL — module not found

**Step 4: Write minimal implementation**

Create `extensions/megapowers/satellite-tdd.ts`:

```typescript
import type { MegapowersState } from "./state-machine.js";
import type { TddTaskState } from "./tdd-guard.js";
import { checkFileWrite } from "./tdd-guard.js";

/**
 * Initialize mutable TDD state for a satellite session.
 * Returns null if not in implement phase or no tasks.
 */
export function createSatelliteTddState(
  state: Readonly<MegapowersState>
): TddTaskState | null {
  if (state.phase !== "implement") return null;
  if (state.planTasks.length === 0) return null;

  const currentTask = state.planTasks[state.currentTaskIndex];
  if (!currentTask) return null;

  if (state.tddTaskState) {
    // Clone from parent — mutable copy
    return { ...state.tddTaskState };
  }

  return {
    taskIndex: currentTask.index,
    state: "no-test",
    skipped: false,
  };
}

export interface SatelliteToolCallResult {
  block: boolean;
  reason?: string;
}

/**
 * Handle a tool_call event in satellite mode.
 * Mutates tddState in place when state transitions occur.
 * Returns null if the tool call is not relevant (not write/edit, no path, etc.).
 * Returns { block, reason } if it's a write/edit that was evaluated.
 */
export function handleSatelliteToolCall(
  toolName: string,
  filePath: string | undefined,
  state: Readonly<MegapowersState>,
  tddState: TddTaskState
): SatelliteToolCallResult | null {
  if (toolName !== "write" && toolName !== "edit") return null;
  if (!filePath) return null;

  const currentTask = state.planTasks[state.currentTaskIndex];
  if (!currentTask) return null;

  const result = checkFileWrite(filePath, state.phase, currentTask, tddState);

  // Apply state transition in place (mutable satellite TDD state)
  if (result.newState) {
    tddState.state = result.newState;
  }

  if (!result.allow) {
    return { block: true, reason: result.reason };
  }

  return { block: false };
}
```

**Step 5: Run tests to verify they pass**

Run: `bun test tests/satellite-tdd.test.ts`
Expected: ALL PASS

**Step 6: Update `index.ts` satellite block to use extracted functions**

Replace the satellite `tool_call` handler in `extensions/megapowers/index.ts`. Change the import:

```typescript
import { createSatelliteTddState, handleSatelliteToolCall } from "./satellite-tdd.js";
```

Replace the entire satellite block (from `if (satellite) {` to `return;`) with:

```typescript
  if (satellite) {
    let satelliteState: Readonly<MegapowersState> | null = null;
    let satelliteTddState: TddTaskState | null = null;

    pi.on("session_start", async (_event, ctx) => {
      satelliteState = loadSatelliteState(ctx.cwd);
      satelliteTddState = satelliteState ? createSatelliteTddState(satelliteState) : null;
    });

    pi.on("tool_call", async (event, _ctx) => {
      if (!satelliteState || !satelliteTddState) return;

      const filePath: string | undefined = (event.input as any)?.path;
      const result = handleSatelliteToolCall(event.toolName, filePath, satelliteState, satelliteTddState);

      if (result && result.block) {
        return { block: true, reason: result.reason };
      }
    });

    pi.on("tool_result", async (event, _ctx) => {
      if (!satelliteTddState) return;
      if (satelliteTddState.state !== "test-written") return;
      if (event.toolName !== "bash") return;

      const command = (event.input as any)?.command;
      if (!command || !isTestRunnerCommand(command)) return;

      const exitCode = event.isError ? 1 : 0;
      const newState = handleTestResult(exitCode, satelliteTddState.state);
      if (newState !== satelliteTddState.state) {
        satelliteTddState.state = newState;
      }
    });

    return; // Skip all primary session setup
  }
```

**Step 7: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add extensions/megapowers/satellite-tdd.ts tests/satellite-tdd.test.ts extensions/megapowers/index.ts
git commit -m "fix: satellite TDD state progression — track mutable state and handle tool_result"
```

---

## Task 2: Add satellite `tool_result` test for test-written → impl-allowed transition

The `handleTestResult` function is already tested in `tdd-guard.test.ts`, but we should add a satellite-specific integration test that verifies the full flow: write test file → state becomes `test-written` → run failing test → state becomes `impl-allowed` → write production file → allowed.

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Modify: `tests/satellite-tdd.test.ts`

**Step 1: Write the failing test**

Add to `tests/satellite-tdd.test.ts`:

```typescript
import { handleTestResult, isTestRunnerCommand } from "../extensions/megapowers/tdd-guard.js";

describe("satellite TDD full flow", () => {
  it("progresses no-test → test-written → impl-allowed → allows production write", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;

    // 1. Start at no-test
    expect(tdd.state).toBe("no-test");

    // 2. Write a test file → advances to test-written
    handleSatelliteToolCall("write", "tests/feature.test.ts", state, tdd);
    expect(tdd.state).toBe("test-written");

    // 3. Production write blocked in test-written
    const blocked = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(blocked!.block).toBe(true);

    // 4. Failing test run → advances to impl-allowed
    expect(isTestRunnerCommand("bun test")).toBe(true);
    const newTddState = handleTestResult(1, tdd.state);
    tdd.state = newTddState;
    expect(tdd.state).toBe("impl-allowed");

    // 5. Production write now allowed
    const allowed = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(allowed!.block).toBe(false);
  });

  it("stays at test-written when tests pass (no failing test)", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;

    // Write test → test-written
    handleSatelliteToolCall("write", "tests/feature.test.ts", state, tdd);
    expect(tdd.state).toBe("test-written");

    // Passing test run → stays at test-written
    const newTddState = handleTestResult(0, tdd.state);
    tdd.state = newTddState;
    expect(tdd.state).toBe("test-written");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `bun test tests/satellite-tdd.test.ts`
Expected: ALL PASS (these tests compose already-working functions — they should pass immediately since Task 1 implemented the state mutation)

Note: If the tests pass immediately, this is expected — we're writing integration tests to lock the behavior, not driving new implementation. The value is in documenting and protecting the full satellite TDD flow.

**Step 3: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add tests/satellite-tdd.test.ts
git commit -m "test: add satellite TDD full-flow integration tests"
```

---

## Task 3: Tighten satellite detection to require `PI_SUBAGENT=1`

Currently `isSatelliteMode` returns `true` when `isTTY === false` even without `PI_SUBAGENT=1`. This is too broad — any non-interactive session (piped output, CI, etc.) would skip all primary features. Change to require the explicit environment signal.

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Modify: `tests/satellite.test.ts`

**Step 1: Run existing tests**

Run: `bun test tests/satellite.test.ts`
Expected: ALL PASS

**Step 2: Update the test expectations**

In `tests/satellite.test.ts`, change the test for `isTTY: false`:

```typescript
  it("returns false when no TTY but no subagent signal (could be CI or piped)", () => {
    expect(isSatelliteMode({ isTTY: false, env: {} })).toBe(false);
  });
```

Also add a new test:

```typescript
  it("returns true when PI_SUBAGENT=1 even without TTY", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/satellite.test.ts`
Expected: FAIL — the `isTTY: false` test now expects `false` but gets `true`

**Step 4: Write minimal implementation**

In `extensions/megapowers/satellite.ts`, simplify `isSatelliteMode`:

```typescript
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  return ctx.env.PI_SUBAGENT === "1";
}
```

Update the JSDoc to reflect the change:

```typescript
/**
 * Detect if the current session is running as a satellite (subagent).
 *
 * A session is satellite only when PI_SUBAGENT=1 is set in environment.
 * This is the explicit signal from the pi subagent tool.
 *
 * We no longer use isTTY === false as a signal because non-interactive
 * contexts (CI, piped output) would incorrectly skip primary features.
 */
```

**Step 5: Run tests to verify they pass**

Run: `bun test tests/satellite.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add extensions/megapowers/satellite.ts tests/satellite.test.ts
git commit -m "fix: tighten satellite detection — require PI_SUBAGENT=1 only"
```

---

## Task 4: Broaden diff parser to handle additional jj summary formats

JJ's `--summary` currently only outputs `M`, `A`, `D` status letters. But to be defensive against future jj versions, broaden the regex to accept any single uppercase letter as a status prefix. Also add a `C` (copied) test case as documentation.

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Modify: `extensions/megapowers/task-coordinator.ts`
- Modify: `tests/task-coordinator.test.ts`

**Step 1: Run existing tests**

Run: `bun test tests/task-coordinator.test.ts`
Expected: ALL PASS

**Step 2: Write the failing tests**

Add to `tests/task-coordinator.test.ts` inside the `parseTaskDiffFiles` describe block:

```typescript
  it("handles hypothetical rename/copy summary lines", () => {
    const output = `R src/old.ts => src/new.ts\nC src/original.ts => src/copy.ts`;
    const files = parseTaskDiffFiles(output);
    // Should extract at least some file path from each line
    expect(files.length).toBe(2);
  });

  it("handles any single-letter status prefix", () => {
    const output = `X src/unknown-status.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/unknown-status.ts"]);
  });
```

**Step 3: Run tests to verify they fail**

Run: `bun test tests/task-coordinator.test.ts`
Expected: FAIL — current regex `[MAD]` doesn't match `R`, `C`, `X`

**Step 4: Write minimal implementation**

In `extensions/megapowers/task-coordinator.ts`, change the summary regex from:

```typescript
    const summaryMatch = line.match(/^[MAD]\s+(.+)$/);
```

to:

```typescript
    const summaryMatch = line.match(/^[A-Z]\s+(.+)$/);
```

This matches any single uppercase letter followed by whitespace and a path. Handles `M`, `A`, `D` as before, plus any future status letters.

For rename/copy lines that use `=>` format (e.g. `R old.ts => new.ts`), the regex will capture `old.ts => new.ts` as the "path". This is acceptable — the report will show the full rename line, which is more informative than showing nothing.

**Step 5: Run tests to verify they pass**

Run: `bun test tests/task-coordinator.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add extensions/megapowers/task-coordinator.ts tests/task-coordinator.test.ts
git commit -m "fix: broaden diff parser to accept any single-letter status prefix"
```

---

## Checkpoint

All three review issues addressed:

- ✅ **Critical: Satellite TDD state progression** — Extracted `satellite-tdd.ts` with mutable state, added `tool_result` hook, full-flow integration tests
- ✅ **Important: Satellite detection too broad** — Simplified to `PI_SUBAGENT=1` only
- ✅ **Important: Diff parser defensiveness** — Broadened regex from `[MAD]` to `[A-Z]`

Run the full test suite to confirm:

```bash
bun test
```

All tests should pass.
