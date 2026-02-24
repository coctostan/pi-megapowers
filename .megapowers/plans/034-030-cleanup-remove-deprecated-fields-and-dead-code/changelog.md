## [034] refactor: remove deprecated fields and dead code

**Type:** Refactor (pure deletion, no behavior changes)
**Batch:** Cleanup follow-up to issue 030 (state source of truth refactor)

### Removed

- `MegapowersState.planTasks` and `MegapowersState.acceptanceCriteria` fields — now derived on demand from artifact files via `deriveTasks()` / `deriveAcceptanceCriteria()`
- `transition()` fallback block reading `state.planTasks` in `state-machine.ts`
- Stale comment referencing deleted `tdd-guard.ts` module in `state-machine.ts`
- `loadSatelliteState()` from `satellite.ts` (and its `createStore` import) — never called after 030's state migration
- `Store.loadState()` and `Store.saveState()` from interface and implementation in `store.ts` — superseded by `state-io.ts`
- `buildPhasePrompt()` from `prompts.ts` — no callers
- `TaskChangeContext`, `shouldCreateTaskChange()`, `abandonTaskChange()`, `squashTaskChanges()` from `task-coordinator.ts` — implemented but never wired

### Test suite

406 pass, 0 fail (net −219 lines of test code: behavioral tests for removed symbols replaced by lightweight negative-assertion guards)
