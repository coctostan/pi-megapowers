## Code Review: 030-state-source-of-truth-refactor

### Critical

1. **`gates.ts` implement→verify gate used deprecated `state.planTasks` instead of `deriveTasks()`** (`gates.ts:61-68`)
   - The gate always saw an empty array since `readState()` strips `planTasks` from KNOWN_KEYS
   - Manual `/phase next` from implement would always fail with "No plan tasks found"
   - **FIXED:** Added `deriveTasks` import, `cwd` parameter to `checkGate`, replaced with `deriveTasks(cwd, state.activeIssue)` + `state.completedTasks`

2. **`ui.ts` used `store.saveState()` (non-atomic, old path) instead of `writeState()` from `state-io.ts`** (6 call sites)
   - State writes from UI were non-atomic and wrote deprecated `planTasks: []` / `acceptanceCriteria: []` back to state.json
   - **FIXED:** All `store.saveState(newState)` calls replaced with `writeState(ctx.cwd, newState)`. Deprecated fields removed from state construction.

3. **`ui.ts` dashboard read `state.planTasks` (always empty) instead of deriving tasks** (12 references)
   - Dashboard showed 0 tasks during implement phase — no progress, no current task, no TDD indicator
   - **FIXED:** `renderDashboardLines` and `renderStatusText` now accept optional `tasks` parameter. `renderDashboard` calls `deriveTasks(ctx.cwd, state.activeIssue)` and passes derived tasks. Task completion computed from `state.completedTasks` instead of `planTasks[].completed`.

### Important

4. **Async fire-and-forget jj operations can race with subsequent `readState`/`writeState` calls** (`tool-signal.ts:146`, `phase-advance.ts:54`)
   - Both `handleTaskDone` and `advancePhase` spawn `(async () => { ... readState/writeState ... })()` fire-and-forget blocks for jj operations that run after the function returns
   - Low risk in practice (jj ops are slow, tool calls are sequential), but the pattern is fragile
   - **Not fixed** — acceptable given pi's sequential tool execution model, noted for future improvement

5. **`satellite.ts:loadSatelliteState` is dead code** — defined but never imported. Minor cleanup.

6. **`store.ts:loadState()` still has `planTasks` backfill logic** (`store.ts:138-142`) — stale code from pre-refactor. Minor cleanup.

### Minor

7. **`prompt-inject.ts:66` — `_jj?: JJ` parameter is unused** — remove when not needed for future work.

8. **Removed deprecated `acceptanceCriteria` display from dashboard** — the verify phase no longer shows criteria counts since they're derived on demand. This is correct per spec (AC7, AC9) but means the dashboard is less informative during verify. Consider adding back with derived data in a future pass.

9. **`canWrite` falls through to `{ allowed: true }` for unknown phases** — defensive but worth a comment.

## Assessment

**ready** — after applying the 3 critical fixes above.

### Summary of fixes applied:
- `gates.ts`: Added `deriveTasks` import, `cwd` parameter, replaced `state.planTasks` with derived tasks
- `phase-advance.ts`: Passes `cwd` to `checkGate`
- `ui.ts`: 
  - Imported `writeState` and `deriveTasks`
  - `renderStatusText`/`renderDashboardLines` accept optional `tasks` param
  - `renderDashboard` derives tasks and passes them
  - All `store.saveState()` → `writeState(ctx.cwd, ...)`
  - Removed `planTasks: []` and `acceptanceCriteria: []` from state construction
  - Removed deprecated `acceptanceCriteria` display from dashboard
- `tests/gates.test.ts`: Updated implement→verify tests to write plan.md and pass `cwd`
- `tests/ui.test.ts`: Updated all tests to pass `cwd` via mock context, use `tasks` param for rendering tests, removed `acceptanceCriteria` assertions

All 418 tests pass.