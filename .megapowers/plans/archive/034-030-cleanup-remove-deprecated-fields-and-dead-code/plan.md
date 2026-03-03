# Plan: 030 Cleanup — Remove Deprecated Fields and Dead Code

## Summary

Pure deletion refactor across 7 production files and 3 test files. No behavior changes. Ordered so that the one migration (satellite.ts → readState) happens before its dependency is removed (store.loadState/saveState).

---

### Task 1: Clean state-machine.ts — remove deprecated fields, fallback logic, and stale comment

**Files:**
- Modify: `extensions/megapowers/state-machine.ts`
- Test: `tests/state-machine.test.ts`

**What to do:**

1. Remove the stale comment on line 16: `// Define TddTaskState locally instead of importing from tdd-guard.ts`
2. Remove the two deprecated fields from `MegapowersState` interface:
   - `planTasks?: PlanTask[];` (and its JSDoc comment)
   - `acceptanceCriteria?: AcceptanceCriterion[];` (and its JSDoc comment)
   - Remove the `// --- DEPRECATED...` comment above them
3. In `transition()`, remove the `else if (to === "implement")` fallback block (lines ~158-163) that reads `state.planTasks`. Keep the preceding `if (to === "implement" && tasks)` block intact.

**Test:** Run `bun test tests/state-machine.test.ts` — all existing tests pass. No new tests needed; TypeScript compilation verifies the fields are gone.

**Verify:** `grep -n 'planTasks\|acceptanceCriteria\|tdd-guard' extensions/megapowers/state-machine.ts` returns nothing.

**Covers:** AC 1, 2, 3, 4

---

### Task 2: Migrate satellite.ts to readState() and remove loadSatelliteState

**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Modify: `tests/satellite.test.ts`

**What to do:**

1. In `satellite.ts`:
   - Replace `import { createStore } from "./store.js"` with `import { readState } from "./state-io.js"`
   - Remove the `import type { MegapowersState } from "./state-machine.js"` (readState returns MegapowersState already)
   - Delete the entire `loadSatelliteState()` function
   - Keep `isSatelliteMode()` and its types unchanged

2. In `tests/satellite.test.ts`:
   - Remove `loadSatelliteState` from the import
   - Delete the entire `describe("loadSatelliteState", ...)` block (lines 31-60)
   - Keep the `describe("isSatelliteMode", ...)` tests

**Test:** `bun test tests/satellite.test.ts` — isSatelliteMode tests pass.

**Verify:** `grep -n 'loadSatelliteState\|createStore' extensions/megapowers/satellite.ts` returns nothing.

**Covers:** AC 5, 6

---

### Task 3: Remove loadState/saveState from store.ts [depends: 2]

**Files:**
- Modify: `extensions/megapowers/store.ts`
- Modify: `tests/store.test.ts`

**What to do:**

1. In `store.ts`:
   - Remove `loadState(): MegapowersState;` from the `Store` interface
   - Remove `saveState(state: MegapowersState): void;` from the `Store` interface
   - Remove the `import { createInitialState, type MegapowersState } from "./state-machine.js"` import (only used by loadState/saveState). Check first: if `createInitialState` or `MegapowersState` is used elsewhere in store.ts, keep it. (It's not — they're only in loadState/saveState.)
   - Remove the `loadState()` implementation (lines ~132-153)
   - Remove the `saveState()` implementation (lines ~155-158)

2. In `tests/store.test.ts`:
   - Delete the entire `describe("state persistence", ...)` block (lines 20-157)
   - Remove any imports that become unused after deletion

**Test:** `bun test tests/store.test.ts` — all remaining tests pass.

**Verify:** `grep -n 'loadState\|saveState\|createInitialState' extensions/megapowers/store.ts` returns nothing.

**Covers:** AC 7, 8, 9, 10

---

### Task 4: Remove buildPhasePrompt from prompts.ts

**Files:**
- Modify: `extensions/megapowers/prompts.ts`

**What to do:**

1. Delete the `buildPhasePrompt()` function and its JSDoc comment (lines ~56-62 in prompts.ts):
   ```
   export function buildPhasePrompt(
     phase: Phase,
     vars: Record<string, string>
   ): string {
     const template = getPhasePromptTemplate(phase);
     if (!template) return "";
     return interpolatePrompt(template, vars);
   }
   ```

**Test:** `bun test tests/prompts.test.ts` — all remaining tests pass (buildPhasePrompt had no tests).

**Verify:** `grep -n 'buildPhasePrompt' extensions/megapowers/prompts.ts` returns nothing.

**Covers:** AC 11

---

### Task 5: Remove dead exports from task-coordinator.ts

**Files:**
- Modify: `extensions/megapowers/task-coordinator.ts`
- Modify: `tests/task-coordinator.test.ts`

**What to do:**

1. In `task-coordinator.ts`:
   - Delete the `shouldCreateTaskChange()` function and its `TaskChangeContext` interface
   - Delete the `abandonTaskChange()` function
   - Delete the `squashTaskChanges()` function

2. In `tests/task-coordinator.test.ts`:
   - Remove `shouldCreateTaskChange` from the import on line 6
   - Delete the entire `describe("shouldCreateTaskChange", ...)` block (lines 83-128)
   - Delete the entire `describe("squashTaskChanges (AC21)", ...)` block (lines 130-164)
   - Keep `describe("buildTaskChangeDescription")`, `describe("parseTaskDiffFiles")`, `describe("buildTaskCompletionReport")`, `describe("createTaskChange")`, and `describe("inspectTaskChange")` — these test live code

**Test:** `bun test tests/task-coordinator.test.ts` — all remaining tests pass.

**Verify:** `grep -n 'shouldCreateTaskChange\|abandonTaskChange\|squashTaskChanges' extensions/megapowers/task-coordinator.ts` returns nothing.

**Covers:** AC 12, 13, 14, 15

---

### Task 6: Final verification [depends: 1, 2, 3, 4, 5]

**Files:**
- No file changes

**What to do:**

1. Run `bun test` — all tests pass, 0 failures
2. Run `grep -rn 'loadSatelliteState\|buildPhasePrompt\|squashTaskChanges\|abandonTaskChange\|shouldCreateTaskChange' extensions/megapowers/ --include='*.ts'` — returns nothing
3. Run `grep -rn 'store\.loadState\|store\.saveState' extensions/megapowers/ --include='*.ts'` — returns nothing

**Covers:** AC 16, 17, 18
