## Test Suite Results

### Full suite (fresh run)
Command:
```bash
bun test > /tmp/verify-full-test.log 2>&1; code=$?; tail -n 40 /tmp/verify-full-test.log; echo EXIT:$code
```
Observed tail output:
- `671 pass`
- `0 fail`
- `Ran 671 tests across 58 files. [600.00ms]`
- `EXIT:0`

### Targeted verification runs (fresh)
- `bun test tests/state-machine.test.ts; echo EXIT:$?` → `39 pass, 0 fail, EXIT:0`
- `bun test tests/tool-plan-task.test.ts; echo EXIT:$?` → `12 pass, 0 fail, EXIT:0`
- `bun test tests/tool-plan-review.test.ts; echo EXIT:$?` → `10 pass, 0 fail, EXIT:0`
- `bun test tests/tool-signal.test.ts -t "review_approve deprecation|plan_draft_done signal"; echo EXIT:$?` → `8 pass, 0 fail, EXIT:0`
- `bun test tests/workflow-configs.test.ts -t "has 7 phases|has 6 phases|no transitions referencing review phase|no review entry in phases array"; echo EXIT:$?` → `5 pass, 0 fail, EXIT:0`
- `bun test tests/write-policy-plan-mode.test.ts; echo EXIT:$?` → `7 pass, 0 fail, EXIT:0`
- `bun test tests/legacy-plan-bridge.test.ts; echo EXIT:$?` → `5 pass, 0 fail, EXIT:0`
- `bun test tests/prompt-inject.test.ts -t "plan mode routing"; echo EXIT:$?` → `3 pass, 0 fail, EXIT:0`
- `bun test tests/plan-store.test.ts; echo EXIT:$?` → `11 pass, 0 fail, EXIT:0`

Issue type check:
- `.megapowers/issues/085-plan-review-iterative-loop-wiring.md` frontmatter has `type: feature`.
- Bugfix reproduction step is not applicable.

## Per-Criterion Verification

### Criterion 1: `MegapowersState` includes `planMode` and `planIteration`.
**Evidence:**
- Code inspection: `extensions/megapowers/state/state-machine.ts:43-52` includes:
  - `planMode: PlanMode;`
  - `planIteration: number;`
**Verdict:** pass

### Criterion 2: `KNOWN_KEYS` includes `planMode` and `planIteration`.
**Evidence:**
- Code inspection: `extensions/megapowers/state/state-io.ts:11-14` includes both keys in `KNOWN_KEYS`.
**Verdict:** pass

### Criterion 3: `createInitialState()` returns `planMode: null` and `planIteration: 0`.
**Evidence:**
- Code inspection: `extensions/megapowers/state/state-machine.ts:83-84`.
- Test run: `tests/state-machine.test.ts` has passing cases:
  - `returns planMode: null`
  - `returns planIteration: 0`
**Verdict:** pass

### Criterion 4: Entering `plan` sets `planMode: "draft"` and `planIteration: 1`.
**Evidence:**
- Code inspection: `extensions/megapowers/state/state-machine.ts:131-135`.
- Test run: `tests/state-machine.test.ts` case `sets planMode to 'draft' and planIteration to 1 when entering plan phase` passed.
**Verdict:** pass

### Criterion 5: Leaving `plan` sets `planMode: null`.
**Evidence:**
- Code inspection: `extensions/megapowers/state/state-machine.ts:138-140`.
- Test run: `tests/state-machine.test.ts` case `resets planMode to null when leaving plan phase` passed.
**Verdict:** pass

### Criterion 6: `megapowers_plan_task` outside `plan` returns error.
**Evidence:**
- Runtime check command (fresh `bun -e` script) printed:
  - `OUTSIDE_PLAN { error: "megapowers_plan_task can only be called during the plan phase." }`
- Test run: `tests/tool-plan-task.test.ts` case `returns error when not in plan phase` passed.
**Verdict:** pass

### Criterion 7: `megapowers_plan_task` in `planMode: "review"` returns error.
**Evidence:**
- Runtime check printed:
  - `REVIEW_MODE { error: "megapowers_plan_task is blocked during review mode..." }`
- Code inspection: `extensions/megapowers/tools/tool-plan-task.ts:28-30`.
- Test run: `tests/tool-plan-task.test.ts` case `returns error when planMode is review` passed.
**Verdict:** pass

### Criterion 8: New task in draft creates `.megapowers/plans/<slug>/tasks/task-NNN.md` via `writePlanTask()`.
**Evidence:**
- Code inspection:
  - create path uses `writePlanTask(...)`: `tool-plan-task.ts:67`
  - response path format includes `tasks/task-XXX.md`: `tool-plan-task.ts:75`
- Runtime check printed:
  - `CREATE ... → .megapowers/plans/001-test/tasks/task-001.md`
- Test run: `tests/tool-plan-task.test.ts` case `creates a task file in draft mode with all defaults` passed.
**Verdict:** pass

### Criterion 9: New task requires `id`, `title`, and `description`.
**Evidence:**
- Tool schema requires `id`: `extensions/megapowers/register-tools.ts:68-70` (`id` is non-optional).
- Create-time validation checks:
  - missing title: `tool-plan-task.ts:43-45`
  - missing description: `tool-plan-task.ts:47-49`
- Test run: `tests/tool-plan-task.test.ts` has passing cases for missing title and missing description validation errors.
**Verdict:** pass

### Criterion 10: New task defaults (`depends_on`, `no_test`, `files_*`, `status`).
**Evidence:**
- Code defaults: `tool-plan-task.ts:54-58`.
- Runtime check `CREATE_DOC` showed:
  - `status: "draft"`
  - `depends_on: []`
  - `no_test: false`
  - `files_to_modify: []`
  - `files_to_create: []`
- Test run: `tests/tool-plan-task.test.ts` default assertions passed.
**Verdict:** pass

### Criterion 11: Existing task update performs partial merge.
**Evidence:**
- Merge logic only applies provided fields: `tool-plan-task.ts:89-108`.
- Runtime check `UPDATE_DOC` preserved old title/body while changing only `depends_on`.
- Test run: `tests/tool-plan-task.test.ts` case `merges only provided fields, preserving existing values` passed.
**Verdict:** pass

### Criterion 12: Update `description` replaces body; omit preserves body.
**Evidence:**
- Code: body selection `const body = params.description ?? existing.content` (`tool-plan-task.ts:110`).
- Runtime checks:
  - update without description preserved body (`UPDATE_DOC`)
  - update with description replaced body (`BODY_DOC` content changed)
- Test run: both relevant cases in `tests/tool-plan-task.test.ts` passed.
**Verdict:** pass

### Criterion 13: Tool response includes path, title, and field-change summary.
**Evidence:**
- Runtime outputs:
  - `CREATE` message includes title + path (`task-001.md`).
  - `UPDATE` message includes title + `Changed: ...` summary.
- Code:
  - create response: `tool-plan-task.ts:73-76`
  - update response: `tool-plan-task.ts:118`
- Observation: create response does not include explicit changed-field list; update response does not include path.
**Verdict:** partial

### Criterion 14: `megapowers_plan_review` outside `plan` or non-`review` mode errors.
**Evidence:**
- Code checks: `tool-plan-review.ts:26-32`.
- Test run: `tests/tool-plan-review.test.ts` phase validation cases passed.
**Verdict:** pass

### Criterion 15: `approve` writes review artifact, approves all tasks, generates `plan.md`, advances to `implement`.
**Evidence:**
- Code path:
  - writes review artifact before verdict branch: `tool-plan-review.ts:46`
  - approves all tasks: `tool-plan-review.ts:95-97`
  - generates `plan.md`: `tool-plan-review.ts:99-101`
  - transitions to implement: `tool-plan-review.ts:104-107`
- Runtime check (`bun -e`) printed:
  - `FILES [ "plan.md", "review-001.md", "tasks" ]`
  - `PHASE implement`
- Test run: approve cases in `tests/tool-plan-review.test.ts` passed (`statuses`, `plan.md`, `advances to implement`).
**Verdict:** pass

### Criterion 16: `revise` writes review artifact, updates per-task status arrays, sets `planMode: "revise"`, bumps iteration.
**Evidence:**
- Code:
  - writes review artifact: `tool-plan-review.ts:46`
  - per-array status updates: `tool-plan-review.ts:48-49`
  - revise state update: `tool-plan-review.ts:72-76`
- Runtime check printed:
  - `FILES [ "review-001.md", "tasks" ]`
  - `STATE { planMode: "revise", planIteration: 2 }`
  - `STATUSES { t1: "approved", t2: "needs_revision" }`
- Test run: revise cases in `tests/tool-plan-review.test.ts` passed.
**Verdict:** pass

### Criterion 17: `revise` at iteration cap returns manual-intervention error.
**Evidence:**
- Code: cap check `if (state.planIteration >= MAX_PLAN_ITERATIONS)` at `tool-plan-review.ts:64-69`.
- Runtime check printed:
  - `"Plan review reached 4 iterations without approval. Human intervention needed..."`
- Test run: `returns error at iteration cap` passed.
**Verdict:** pass

### Criterion 18: `approved_tasks` and `needs_revision_tasks` both applied to task statuses.
**Evidence:**
- Code uses both arrays: `tool-plan-review.ts:35-36, 48-49`.
- Runtime check statuses reflected both arrays (`t1 approved`, `t2 needs_revision`).
- Test run: `updates task statuses per verdict arrays` passed.
**Verdict:** pass

### Criterion 19: `plan_draft_done` transitions `draft|revise -> review`.
**Evidence:**
- Code: mode guard + transition write at `tool-signal.ts:251-253, 260`.
- Runtime check from revise mode showed `STATE review`.
- Test run: both transition cases (`draft` and `revise`) passed.
**Verdict:** pass

### Criterion 20: `plan_draft_done` errors when no tasks exist (`listPlanTasks`).
**Evidence:**
- Code: `const tasks = listPlanTasks(...)` and length check `tool-signal.ts:255-257`.
- Runtime check printed:
  - `EMPTY { error: "No task files found..." }`
- Test run: `returns error when no task files exist` passed.
**Verdict:** pass

### Criterion 21: `plan_draft_done` calls `newSession()` on mode transition.
**Evidence:**
- Signal result sets `triggerNewSession: true` at `tool-signal.ts:266`.
- Tool execution wrapper calls `newSession()` when flag is set: `register-tools.ts:41-44`.
- Test run: `sets triggerNewSession flag` passed.
**Verdict:** pass

### Criterion 22: `review_approve` deprecation error points to `megapowers_plan_review`.
**Evidence:**
- Code: `tool-signal.ts:275-278`.
- Runtime check printed deprecation error with `megapowers_plan_review` instruction.
- Test run: `review_approve deprecation` case passed.
**Verdict:** pass

### Criterion 23: Feature workflow phases have no `review`.
**Evidence:**
- Code: `extensions/megapowers/workflows/feature.ts:6-14` phases list excludes `review`.
- Test run: `has 7 phases in correct order` and `has no review entry in phases array` passed.
**Verdict:** pass

### Criterion 24: Bugfix workflow phases have no `review`.
**Evidence:**
- Code: `extensions/megapowers/workflows/bugfix.ts:6-13` phases list excludes `review`.
- Test run: `has 6 phases in correct order` passed.
**Verdict:** pass

### Criterion 25: No transitions reference `review` in either workflow.
**Evidence:**
- Code inspection:
  - feature transitions: `feature.ts:15-24` (no `review`)
  - bugfix transitions: `bugfix.ts:14-21` (no `review`)
- Test run: both `has no transitions referencing review phase` cases passed.
**Verdict:** pass

### Criterion 26: `Phase` union retains `"review"` for backward compatibility.
**Evidence:**
- Code: `state-machine.ts:5-7` includes `review` in feature and bugfix phase unions.
- Test run: `Phase type — backward compat > 'review' is still a valid Phase value` passed.
**Verdict:** pass

### Criterion 27: In `draft`, direct `write/edit` to task files blocked; only `megapowers_plan_task` creates tasks.
**Evidence:**
- Write policy blocks task file writes in draft: `write-policy.ts:85-90`.
- Test run: `tests/write-policy-plan-mode.test.ts` case `blocks write/edit to task files in draft mode` passed.
- `megapowers_plan_task` create path verified in Criterion 8.
**Verdict:** pass

### Criterion 28: In `review`, `megapowers_plan_task` blocked and task file modifications blocked.
**Evidence:**
- `megapowers_plan_task` blocked in review: `tool-plan-task.ts:28-30`.
- Write policy blocks review task file writes: `write-policy.ts:86-90`.
- Tests:
  - `tool-plan-task.test.ts` review-mode error passed
  - `write-policy-plan-mode.test.ts` review-mode write/edit block passed
**Verdict:** pass

### Criterion 29: In `revise`, `megapowers_plan_task` can update frontmatter and `edit` can modify bodies.
**Evidence:**
- `megapowers_plan_task` allows `draft|revise`: `tool-plan-task.ts:32-34`.
- Write policy allows `edit` in revise while blocking `write`: `write-policy.ts:92-99`.
- Tests:
  - `tool-plan-task.test.ts` `works in revise mode` passed
  - `write-policy-plan-mode.test.ts` `allows edit` + `blocks write` in revise passed
**Verdict:** pass

### Criterion 30: `generateLegacyPlanMd()` outputs required task heading + annotations.
**Evidence:**
- Code:
  - header format `### Task N: Title`: `legacy-plan-bridge.ts:19`
  - `[no-test]` annotation: `legacy-plan-bridge.ts:13`
  - `[depends: ...]` annotation: `legacy-plan-bridge.ts:15`
- Test run: all corresponding tests in `tests/legacy-plan-bridge.test.ts` passed.
**Verdict:** pass

### Criterion 31: Generated `plan.md` is parseable by `extractPlanTasks()`.
**Evidence:**
- Test run: `generateLegacyPlanMd > is parseable by extractPlanTasks (backward compat)` passed.
**Verdict:** pass

### Criterion 32: `planMode=draft` loads `write-plan.md` (tool-instruction rework).
**Evidence:**
- Prompt router mapping: `prompt-inject.ts:139-141` (`draft: "write-plan.md"`).
- Test run: `prompt-inject.test.ts` case `loads write-plan.md when planMode is draft` passed.
- Prompt content includes `megapowers_plan_task` guidance: `prompts/write-plan.md:95-109`.
**Verdict:** pass

### Criterion 33: `planMode=review` loads `review-plan.md` (tool-instruction rework).
**Evidence:**
- Prompt router mapping: `prompt-inject.ts:141`.
- Test run: `prompt-inject.test.ts` case `loads review-plan.md when planMode is review` passed.
- Prompt content includes `megapowers_plan_review` instructions: `prompts/review-plan.md:82-99`.
**Verdict:** pass

### Criterion 34: `planMode=revise` loads new `revise-plan.md` template.
**Evidence:**
- Prompt router mapping includes `revise: "revise-plan.md"`: `prompt-inject.ts:142`.
- `prompts/revise-plan.md` exists and contains revise instructions (`lines 1-21`).
- Test run: `prompt-inject.test.ts` case `does not load write-plan.md when planMode is revise` passed (consistent with revise template routing).
**Verdict:** pass

### Criterion 35: Mode transitions draft→review, review→revise, revise→review trigger `newSession()`.
**Evidence:**
- draft/revise→review: `tool-signal.ts:260-267` sets mode and `triggerNewSession: true`.
- review→revise: `tool-plan-review.ts:72-76, 84` sets mode/iteration and `triggerNewSession: true`.
- Trigger wiring to actual session call:
  - signal tool: `register-tools.ts:41-44`
  - plan review tool: `register-tools.ts:103-106`
- Tests:
  - `tool-signal.test.ts` `sets triggerNewSession flag` passed
  - `tool-plan-review.test.ts` `sets triggerNewSession flag on revise` passed
**Verdict:** pass

### Criterion 36: `readPlanTask`, `readPlanSummary`, `readPlanReview` return `EntityDoc<T> | { error: string } | null`.
**Evidence:**
- `readPlanTask` signature matches: `plan-store.ts:29`.
- `readPlanReview` signature matches: `plan-store.ts:61-65`.
- No `readPlanSummary` implementation found:
  - Command: `grep -R "readPlanSummary" -n extensions tests || true; echo EXIT:$?`
  - Output: no matches; `EXIT:0`.
  - Also `grep -n "export function readPlan" extensions/megapowers/state/plan-store.ts` shows only `readPlanTask` and `readPlanReview`.
**Verdict:** fail

### Criterion 37: `zeroPad` uses `padStart(3, "0")`.
**Evidence:**
- Code: `plan-store.ts:6-7`.
- Test run: `tests/plan-store.test.ts` zeroPad tests passed.
**Verdict:** pass

### Criterion 38: `MAX_PLAN_ITERATIONS` constant equals `4`.
**Evidence:**
- Code: `state-machine.ts:10`.
- Test run: `tests/state-machine.test.ts` case `MAX_PLAN_ITERATIONS > is exported and equals 4` passed.
**Verdict:** pass

## Overall Verdict
fail

Summary:
- Verified implementation is strong and satisfies almost all acceptance criteria with direct test and code evidence.
- Blocking issue: **Criterion 36 failed** because `readPlanSummary` is missing entirely.
- Additional quality gap: **Criterion 13 is partial** (path/title/change-summary split across create vs update responses rather than consistently present in each response).

Recommended next steps in implement phase:
1. Add `readPlanSummary` API (with required return type semantics: `null` for not found, `{ error }` for parse failure).
2. Align `megapowers_plan_task` response format so each response includes path + title + change summary (or explicitly clarify criterion behavior and add tests).
3. Re-run targeted tests and full suite, then return to verify.
