# Spec: 030 Cleanup — Remove Deprecated Fields and Dead Code

## Goal

Remove deprecated state fields, dead exports, and stale code left behind by issue 030's incomplete Phase 3 cleanup. This is a pure deletion refactor — no behavior changes, no new features. The codebase should contain only code that is actively called from production paths.

## Acceptance Criteria

1. `MegapowersState` interface in `state-machine.ts` does not contain a `planTasks` field
2. `MegapowersState` interface in `state-machine.ts` does not contain an `acceptanceCriteria` field
3. The `transition()` function in `state-machine.ts` has no fallback logic reading `state.planTasks`
4. The stale comment referencing `tdd-guard.ts` in `state-machine.ts` is removed
5. `satellite.ts` uses `readState()` from `state-io.ts` instead of `store.loadState()`
6. The `loadSatelliteState()` function is removed from `satellite.ts`
7. The `Store` interface in `store.ts` does not contain a `loadState` method
8. The `Store` interface in `store.ts` does not contain a `saveState` method
9. The `loadState` implementation is removed from `store.ts`
10. The `saveState` implementation is removed from `store.ts`
11. The `buildPhasePrompt()` function is removed from `prompts.ts`
12. The `squashTaskChanges()` function is removed from `task-coordinator.ts`
13. The `abandonTaskChange()` function is removed from `task-coordinator.ts`
14. The `shouldCreateTaskChange()` function is removed from `task-coordinator.ts`
15. Tests for `shouldCreateTaskChange` are removed from `tests/task-coordinator.test.ts`
16. Tests for `loadState`/`saveState` are removed from `tests/store.test.ts`
17. All remaining tests pass (`bun test` — 0 failures)
18. No production file imports `loadSatelliteState`, `buildPhasePrompt`, `squashTaskChanges`, `abandonTaskChange`, or `shouldCreateTaskChange`

## Out of Scope

- Extracting slash command handlers from `index.ts` (issue 035)
- Wiring AC20 jj task change creation into `handleTaskDone`
- Any behavior changes to existing functionality
- Adding new tests (this is pure deletion)

## Open Questions

None.
