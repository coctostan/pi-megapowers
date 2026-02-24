# Plan Review: 030-state-source-of-truth-refactor

Scope: quick sanity check (not a deep audit). Review target: `.megapowers/plans/030-state-source-of-truth-refactor/plan.md`.

## Dependency sanity checks (Kota)

Kota dependency graph highlights (direct dependents):

- `extensions/megapowers/state-machine.ts` is imported by:
  - `extensions/megapowers/index.ts`
  - `extensions/megapowers/plan-parser.ts`
  - `extensions/megapowers/prompts.ts`
  - `extensions/megapowers/store.ts`
  - `extensions/megapowers/ui.ts`
  - Tests: `tests/prompts.test.ts`, `tests/state-machine.test.ts`, `tests/store.test.ts`, `tests/ui.test.ts`

  (Source: `kota_deps` on `state-machine.ts`.)

- `extensions/megapowers/store.ts` is imported by:
  - `extensions/megapowers/index.ts`
  - `extensions/megapowers/ui.ts`
  - `tests/store.test.ts`

  (Source: `kota_deps` on `store.ts`.)

- `extensions/megapowers/ui.ts` is imported by:
  - `extensions/megapowers/index.ts`
  - `tests/ui.test.ts`

  (Source: `kota_deps` on `ui.ts`.)

Implication: any signature/type changes to `state-machine.ts`, `store.ts`, `gates.ts` must be coordinated **before** Task 13’s `index.ts` rewrite, because `index.ts` imports `ui.ts` and `store.ts`.

---

## 1) Coverage check (Acceptance Criteria)

### Gaps / mismatches

1. **AC19–21 (jj integration) is explicitly descoped in the plan.**
   - Current spec still lists AC19–21 as required.
   - Action: either (a) update the spec/issue to mark AC19–21 out-of-scope for this issue, or (b) add tasks implementing jj behavior in `megapowers_signal` (`phase_next` entering implement, per-task change management, done squashing).

2. **AC38 (mega off hides custom tools) is not actually satisfied by “early-return error”.**
   - The plan makes `megapowers_signal`/`megapowers_save_artifact` return an error when `megaEnabled=false` (Tasks 7–8), but the tools remain registered and therefore still appear in the tool list exposed to the LLM.
   - Action (recommended): add a task that toggles the *active tool list* when mega is off, e.g. using `pi.setActiveTools(...)` so `megapowers_signal` and `megapowers_save_artifact` are not presented to the model. (You can verify the availability of `setActiveTools` via the exported `ExtensionActions` type.)
   - Alternative: explicitly amend AC38 wording to allow “tool remains registered but is inert/blocked”.

3. **AC42 (phase-specific tool-call instructions) is missing.**
   - `prompts/*.md` currently contain **no** instructions mentioning `megapowers_signal` or `megapowers_save_artifact` (confirmed by grep).
   - Task 11 adds a protocol file, but does not add phase-specific directions like “when spec is done, call `megapowers_save_artifact` with phase 'spec'”.
   - Action: add a task to update prompt templates (or augment `buildInjectedPrompt()` to append a small phase-specific tool instruction block per phase).

### OK coverage

- AC1–4, 6–7, 10–18, 22–37, 39–41, 43–47, 48–55 are mostly represented by tasks, but several of these are at risk due to ordering/completeness issues noted below.

---

## 2) Ordering check

### Ordering issues that will break compilation/integration

1. **Task 5 changes `checkGate()` signature but UI imports `checkGate` today.**
   - Current `extensions/megapowers/ui.ts` imports `checkGate` and will need updating if `checkGate(state,target,cwd)` replaces `checkGate(state,target,store)`.
   - The plan delays UI migration to Task 16/18, but Task 13’s rewritten `index.ts` imports `ui.ts`. By Task 13, `ui.ts` must already compile against the new `gates.ts` signature.
   - Action: move the `ui.ts` gate-call migration earlier (same task as Task 5, or a new task inserted before Task 13).

2. **State schema changes in Task 1 collide with current `store.ts` and `ui.ts`.**
   - Today both `store.ts` and `ui.ts` depend on `state.planTasks` and `state.acceptanceCriteria`.
   - Task 1 removes these from `MegapowersState`, but the plan doesn’t update `store.ts`/`ui.ts` until late (Tasks 16–18).
   - Action: either (a) keep `planTasks`/`acceptanceCriteria` in the type temporarily (deprecate first, remove later), or (b) move the `store.ts` and `ui.ts` migrations earlier so the code compiles when Task 13 imports them.

3. **Task 16/18 are effectively “big bang” migrations with no tests/code.**
   - Because Tasks 16–18 are where most remaining callers are updated, they need to happen before integration is asserted.
   - Action: split Task 16 and Task 18 into smaller, test-backed tasks (see completeness).

---

## 3) Completeness check

### Critical blockers

1. **Task 18 is truncated / incomplete.**
   - The plan ends mid-sentence: “Update test assertions that reference `planTasks` or `acceptanceCriteria` on …”.
   - Missing: specific edits, full test code, and a Verify command.
   - Action: rewrite Task 18 as one or more complete tasks with:
     - explicit file edits for `ui.ts`, `store.ts`, `state-machine.ts`, `tests/state-machine.test.ts`, `tests/ui.test.ts`, and any other impacted tests.

2. **Tasks 14 and 15 are marked `[no-test]` / manual verification, which violates the plan’s own rule: “Each task maps 1:1 to a test.”**
   - Action: either:
     - fold Tasks 14–15 into Task 13 (and keep Task 13 as the *single* “integration” task), or
     - add explicit tests that validate:
       - `/mega off` toggles `state.megaEnabled` on disk,
       - `/task done`, `/review approve`, `/phase next` call the same shared handlers,
       - tool registration includes the three overrides and the two custom tools in primary mode, and excludes the custom tools in satellite mode.

### High-risk implementation details (actionable fixes)

3. **`readState()` currently merges `{...defaults, ...raw}` without stripping unknown keys.**
   - That can preserve legacy `planTasks`/`acceptanceCriteria` keys and accidentally re-persist them later, violating AC7.
   - Action: in `readState`, explicitly construct a “thin state” by picking only allowed keys, OR delete disallowed keys before returning.

4. **`completedTasks` semantics are inconsistent across tasks/tests.**
   - Example: Task 1 test uses `completedTasks: [0, 1]` while later tasks treat task indices as `1,2,...` from `PlanTask.index`.
   - Action: define explicitly (in plan + code):
     - `currentTaskIndex` = array index into derived `tasks[]`
     - `completedTasks[]` = either array indices (0-based) **or** `PlanTask.index` values (1-based)
     - Update *all* task code/tests to match.

5. **TDD state should be tied to the current task.**
   - Current plan checks `tddTaskState.state` but does not validate `tddTaskState.taskIndex` matches the current task.
   - Risk: a previous task’s `impl-allowed` could allow production writes / task completion for the next task.
   - Action: in `canWrite` and in `handleTaskDone`, require `tddTaskState.taskIndex === currentTask.index` (unless skipped or `[no-test]`).

6. **Task 12’s `createSatelliteWriteChecker` snippet references `isAllowlisted()` but Task 9 only imports `{ canWrite, isTestFile }` from `write-policy.ts`.**
   - Action: ensure `tool-overrides.ts` imports `isAllowlisted` (or re-export it) so the satellite checker compiles.

7. **Task 13’s import path for tool factories is wrong.**
   - The SDK exports `createWriteTool/createEditTool/createBashTool` from `@mariozechner/pi-coding-agent` (confirmed by `dist/index.d.ts`).
   - Action: update Task 13 code to import from `@mariozechner/pi-coding-agent` (not `@mariozechner/pi-coding-agent/tools`).

---

## Verdict (preliminary)

**revise**

The plan is close in spirit, but it has several blockers that will prevent a developer from executing it cleanly:

- AC42 and AC38 are not satisfied as written.
- Task ordering will break because `ui.ts`/`store.ts` compile against old state + gates APIs but Task 13 imports them.
- Task 18 is incomplete.
- Tasks 14–15 violate the “1 task ↔ 1 test” rule.

## Confirmation questions

1. Do you want AC19–21 (jj integration) to remain **descoped** for this issue (meaning we should update the spec/AC table), or should we add tasks to implement them now?
2. For AC38: do you want *true hiding* (remove from active tools list) or is “registered but blocked” acceptable?
3. For `completedTasks`: should it store **task numbers** (`PlanTask.index`, typically 1-based), or **array indices** (0-based, aligns with `currentTaskIndex`)?
