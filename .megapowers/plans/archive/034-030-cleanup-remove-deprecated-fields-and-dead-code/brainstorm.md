# Brainstorm: 030 Cleanup — Remove Deprecated Fields and Dead Code

## Problem

Issue 030 (state source of truth refactor) shipped successfully but left Phase 3 cleanup incomplete. The core architecture is correct (disk-first, tool-first, thin schema), but deprecated fields, dead exports, and stale code remain across several modules. None of this is broken — `readState()` strips the deprecated fields at runtime — but it's confusing for future contributors and adds unnecessary surface area.

## Investigation Findings

### Dead state fields
- `planTasks?` and `acceptanceCriteria?` on `MegapowersState` interface in `state-machine.ts` — stripped by `readState()`, never populated by any writer
- Fallback logic in `transition()` (lines 158-160) that reads `state.planTasks` — dead since `readState()` strips it
- Stale comment on `state-machine.ts:16` referencing deleted `tdd-guard.ts`

### Dead exports
- `loadSatelliteState()` in `satellite.ts` — exported, zero callers
- `buildPhasePrompt()` in `prompts.ts` — exported, zero callers (learnings confirm it became dead when done-phase needed lower-level functions)
- `squashTaskChanges()` in `task-coordinator.ts` — exported, zero callers
- `abandonTaskChange()` in `task-coordinator.ts` — exported, zero callers
- `shouldCreateTaskChange()` in `task-coordinator.ts` — exported, only called from tests (never wired into production)

### Deprecated store methods
- `store.loadState()` / `store.saveState()` — superseded by `readState()` / `writeState()` from `state-io.ts`
- One remaining production caller: `satellite.ts:28` uses `store.loadState()`
- `store.loadState()` has dead `planTasks` backfill logic (lines 144-149)

### Test cleanup needed
- `tests/task-coordinator.test.ts` tests for `shouldCreateTaskChange` which is dead in production
- `tests/store.test.ts` tests `loadState`/`saveState` — sections need removal after methods are deleted

## Approach

Pure deletion refactor. Migrate the one `satellite.ts` caller to `readState()`, then remove all dead code. No behavior changes. All 418 tests should still pass (minus removed tests for deleted code).

## Key Decisions

- **Don't delete `task-coordinator.ts` itself** — `createTaskChange`, `inspectTaskChange`, and `buildTaskCompletionReport` are actively used by `tool-signal.ts`
- **Do delete `shouldCreateTaskChange`** — never wired into production, only tested in isolation
- **Migrate `satellite.ts` to `readState()`** before removing `store.loadState/saveState`
- **Keep `squashTaskChanges`/`abandonTaskChange` deletion separate from AC20** — if AC20 is implemented later, it can re-add them with proper wiring

## Scope (files touched)

1. `state-machine.ts` — remove `planTasks?`, `acceptanceCriteria?` fields + fallback logic + stale comment
2. `store.ts` — remove `loadState()`, `saveState()` from interface and implementation
3. `satellite.ts` — migrate to `readState()`, delete `loadSatelliteState()`
4. `prompts.ts` — remove `buildPhasePrompt()`
5. `task-coordinator.ts` — remove `squashTaskChanges()`, `abandonTaskChange()`, `shouldCreateTaskChange()`
6. `tests/task-coordinator.test.ts` — remove `shouldCreateTaskChange` tests
7. `tests/store.test.ts` — remove `loadState`/`saveState` test sections

## Out of scope

- Extracting slash commands from `index.ts` (filed as issue 035)
- Wiring AC20 jj task change creation
