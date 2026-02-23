# Plan Review: State Source of Truth Refactor

## Verdict: **revise**

The approach is sound. The plan's three-phase strategy (build alongside → switch over → clean up) is the right way to do this. Six specific issues need fixing before implementation.

---

## 1. Coverage Gaps

### AC10 — hasOpenQuestions sentinel logic is too loose
Task 3's implementation returns `true` for any non-empty, non-sentinel line. But AC10 says: "Only actual question items (lines starting with `- ` or numbered items containing `?`) count as open questions." The proposed code treats `Some random text without a question mark` as an open question. It needs to be tightened: after filtering sentinels and blank lines, only lines matching `^[-*]\s+` or `^\d+[.)]\s+` that contain `?` should count.

### AC19–21 — jj integration not actually implemented
The coverage table claims Tasks 9/10 cover AC19 (create issue-level jj change on phase_next→implement), AC20 (per-task jj change on task_done), and AC21 (squash on phase_next→done). But Task 9 explicitly says "jj integration is deferred to Task 10" and Task 10's implementation has `_jj?: JJ` unused parameters with no jj calls. No task actually implements jj operations. Either add a dedicated task for jj integration in tool-signal.ts, or move AC19–21 to out-of-scope.

### AC38 — "effectively hidden" custom tools when mega off
The plan toggles prompt injection and enforcement, but `megapowers_signal` and `megapowers_save_artifact` remain registered and callable. The spec says they should be "effectively hidden from the LLM." If prompt injection removal is sufficient (the LLM won't know about tools it's not told about), document that explicitly. If not, the tools need to early-return with an error when `megaEnabled` is false.

---

## 2. Ordering Issues

### Task 1 depends on Task 2 (not the reverse)
Task 1's tests assert `state.completedTasks` and `state.megaEnabled` exist on the initial state from `readState()`. But those fields are added to `createInitialState()` in Task 2. As written, Task 1's tests will fail. Fix: either swap the order (Task 2 first), or merge the type changes into Task 1.

### Task 16 will break files not listed in its scope
Removing `store.loadState()`/`store.saveState()` at Task 16 will break:
- `extensions/megapowers/satellite.ts` — `loadSatelliteState()` calls `store.loadState()`
- `tests/satellite.test.ts` — uses `store.saveState()` in fixtures
- `extensions/megapowers/ui.ts` — calls `store.saveState()` for state persistence
- `tests/tools.test.ts` — references `store.loadState()`

Task 16 only mentions updating `tests/store.test.ts`. All other call sites must be migrated before or during Task 16.

### Task 17 misses task-coordinator.ts
`task-coordinator.ts` and `tests/task-coordinator.test.ts` reference `planTasks` on the state type. Task 17 removes `planTasks` from `MegapowersState` but doesn't list `task-coordinator.ts` for deletion or refactoring. This will cause compile failures. Since the new `tool-signal.ts` replaces task coordination logic, `task-coordinator.ts` should be added to Task 17's deletion list.

---

## 3. Completeness Issues

### Task 11 test imports a non-existent export
The test file imports `checkBashOverride` but the implementation exports `processBashResult`. This is a straight compile error in the test.

### Task 10 TDD validation has a null-safety gap (AC13)
When `tddTaskState` is `null` for a non-`[no-test]` task, the current logic (`if (tdd && !tdd.skipped && tdd.state !== "impl-allowed")`) passes through because `tdd` is null — the `&&` short-circuits. This means a task with no TDD state at all would be marked complete without TDD validation. AC13 requires validation. The check should be: if the task is not `[no-test]` AND `tddTaskState` is null or not `impl-allowed`, block.

### Task 6 has an unfinished TODO for implement entry
When `advancePhase()` transitions to `implement`, it needs to set `currentTaskIndex` to the first incomplete task (derived from `plan.md` + `completedTasks`). The implementation has a comment saying "Find first incomplete task" but no code. On session resume with partially completed tasks, `currentTaskIndex` would reset to 0 (an already-completed task).

### Task 15 bash exit code detection is hand-waved
The implementation guesses exit codes via regex on result text (`/exit code [1-9]/`). AC33 requires pass/fail based on actual exit code. The plan needs to specify how pi's `createBashTool` result exposes exit codes (e.g., `result.details.exitCode` or `result.isError`) and use that.

### Task 15 index.ts is incomplete
The implementation says "full implementations follow the same pattern" for `/issue`, `/done`, `/learn`, `/triage` commands and the `create_batch` tool. These are ~200 lines of existing functionality that must be ported to readState/writeState. The task should either include the full code or be split into sub-tasks.

---

## Required Changes

1. **Task 1/2 ordering**: Make Task 2 (add `completedTasks`/`megaEnabled` to state type) come before Task 1 (state-io), or merge the type additions into Task 1.

2. **Task 3 (AC10)**: Tighten `hasOpenQuestions()` — after filtering sentinels and blanks, only count lines matching list-item patterns (`- `, `1. `, etc.) that contain `?`.

3. **Add jj task or descope AC19–21**: Either add a Task between 10 and 11 that implements jj operations in `handlePhaseNext` and `handleTaskDone`, or move AC19–21 to out-of-scope with a note that jj integration is deferred.

4. **Task 10 (AC13)**: Fix null-safety — when `tddTaskState` is null and task is not `[no-test]`, block with error "TDD state not initialized. Write a test file first."

5. **Task 16 scope expansion**: Add `satellite.ts`, `tests/satellite.test.ts`, `ui.ts`, and `tests/tools.test.ts` to the migration list. Update `loadSatelliteState()` to use `readState()`.

6. **Task 17 additions**: Add `task-coordinator.ts` and `tests/task-coordinator.test.ts` to the deletion list.

7. **Task 11 fix**: Change test import from `checkBashOverride` to `processBashResult`.

8. **Task 6 fix**: Implement the `currentTaskIndex` initialization when entering implement — find first task index where `!completedTasks.includes(tasks[i].index)`.

9. **Task 15 specifics**: Pin down how bash exit code is obtained from pi's tool result. Include full code for ported slash commands or split into sub-tasks.
