# Done: 034 — Remove Deprecated Fields and Dead Code

## Branch
`feat/034-cleanup-deprecated-fields-dead-code` (based off `feat/030-state-source-of-truth-refactor`)

## Summary

Pure deletion refactor completing the cleanup left unfinished by issue 030. All deprecated fields, dead exports, and stale code identified in 030's post-ship review are now removed. No behavior changed.

## What Changed

### `extensions/megapowers/state-machine.ts`
- Removed `planTasks?: PlanTask[]` and `acceptanceCriteria?: AcceptanceCriterion[]` from `MegapowersState` — these fields were superseded by on-demand derivation from artifact files via `deriveTasks()` / `deriveAcceptanceCriteria()`
- Removed `else if (to === "implement")` fallback block that read `state.planTasks` — the live `if (to === "implement" && tasks)` path is the only valid path
- Removed stale comment `// Define TddTaskState locally instead of importing from tdd-guard.ts` — `tdd-guard.ts` was deleted in issue 030

### `extensions/megapowers/satellite.ts`
- Deleted `loadSatelliteState()` and its `createStore` import — never called from production after 030's state migration; file now contains only `isSatelliteMode()`

### `extensions/megapowers/store.ts`
- Removed `loadState(): MegapowersState` and `saveState(state: MegapowersState): void` from the `Store` interface and implementation
- Removed `import { createInitialState, type MegapowersState }` (only used by the deleted methods)

### `extensions/megapowers/prompts.ts`
- Removed `buildPhasePrompt()` — thin wrapper with no callers; callers use `getPhasePromptTemplate` + `interpolatePrompt` directly

### `extensions/megapowers/task-coordinator.ts`
- Removed `TaskChangeContext` interface, `shouldCreateTaskChange()`, `abandonTaskChange()`, `squashTaskChanges()` — implemented for jj task-change tracking but never wired into `handleTaskDone` (tracked separately as known gap AC20)

## Test Changes

- `tests/satellite.test.ts` — removed `describe("loadSatelliteState")` block; kept `isSatelliteMode` tests
- `tests/store.test.ts` — removed `describe("state persistence", ...)` (138 lines); replaced with negative-assertion guard
- `tests/task-coordinator.test.ts` — removed `describe("shouldCreateTaskChange")` and `describe("squashTaskChanges")` behavioral blocks; replaced with `describe("dead exports")` guard asserting removed symbols are undefined

## Acceptance Criteria

All 18 criteria verified — see `verify.md`. Summary:
- AC1–4: `state-machine.ts` cleaned ✓
- AC5–6: `satellite.ts` cleaned ✓
- AC7–10: `store.ts` cleaned ✓
- AC11: `prompts.ts` cleaned ✓
- AC12–15: `task-coordinator.ts` cleaned ✓
- AC16: `store.test.ts` cleaned ✓
- AC17: 406 pass, 0 fail ✓
- AC18: no production imports of removed symbols ✓

## Known Remaining Items (Non-blocking)

- AC20: jj task change creation on `task_done` still not wired (`createTaskChange`/`inspectTaskChange` exist in `task-coordinator.ts` but aren't called from `handleTaskDone`). Tracked separately.
