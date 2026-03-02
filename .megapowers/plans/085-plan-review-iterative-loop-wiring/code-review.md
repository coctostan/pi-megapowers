# Code Review — 085-plan-review-iterative-loop-wiring

## Files Reviewed

- `extensions/megapowers/state/state-machine.ts` — `PlanMode` type, `MAX_PLAN_ITERATIONS`, `planMode`/`planIteration` fields, `transition()` hooks
- `extensions/megapowers/state/state-io.ts` — `KNOWN_KEYS` additions
- `extensions/megapowers/state/plan-schemas.ts` — `PlanTask`, `PlanReview`, `PlanSummary` Zod schemas
- `extensions/megapowers/state/plan-store.ts` — `zeroPad()`, `readPlanTask/Review/Summary`, `writePlanTask/Review`, `listPlanTasks`, `updateTaskStatuses`
- `extensions/megapowers/state/entity-parser.ts` — `parseFrontmatterEntity`, `EntityDoc` type
- `extensions/megapowers/state/legacy-plan-bridge.ts` — `generateLegacyPlanMd()`
- `extensions/megapowers/tools/tool-plan-task.ts` — `handlePlanTask()`, create/update logic
- `extensions/megapowers/tools/tool-plan-review.ts` — `handlePlanReview()`, approve/revise verdict handlers
- `extensions/megapowers/tools/tool-signal.ts` — `handlePlanDraftDone()`, `handleReviewApprove()` deprecation
- `extensions/megapowers/policy/write-policy.ts` — plan-mode-aware task file restrictions
- `extensions/megapowers/register-tools.ts` — `megapowers_signal` / `megapowers_plan_task` / `megapowers_plan_review` registration, `newSession()` wiring
- `extensions/megapowers/prompt-inject.ts` — `PLAN_MODE_TEMPLATES`, plan-mode branch
- `extensions/megapowers/workflows/feature.ts` — `review` phase removed
- `extensions/megapowers/workflows/bugfix.ts` — `review` phase removed
- `prompts/write-plan.md` — updated to instruct `megapowers_plan_task` use
- `prompts/review-plan.md` — updated for new task-file-based review flow
- `prompts/revise-plan.md` — new template for revise mode

## Strengths

- **Disk-first state discipline** (`tool-plan-review.ts:24`, `tool-signal.ts:245`): Every handler calls `readState(cwd)` at entry rather than passing state — consistent with the project's disk-first architecture.
- **Clean schema layer** (`plan-schemas.ts`): Zod schemas for `PlanTask`, `PlanReview`, `PlanSummary` are tight with sensible defaults. Zod's `.default([])` on array fields prevents a whole class of nil-dereference bugs.
- **Backward-compat bridge** (`legacy-plan-bridge.ts:8-25`): `generateLegacyPlanMd()` is a focused 25-line module with a single responsibility. The round-trip test against `extractPlanTasks()` gives real confidence that downstream consumers aren't broken.
- **Partial-merge update path** (`tool-plan-task.ts:81-125`): Using `!== undefined` checks (not falsiness) for each field means callers can explicitly zero out numeric fields like `depends_on` without being silently ignored.
- **Iteration cap placement** (`tool-plan-review.ts:64-70`): Checked in `handleReviseVerdict` before state mutation — the state never advances past the cap. The review artifact is still written (capturing the feedback), which is the right behaviour for auditability.
- **`newSession()` wiring pattern** (`register-tools.ts:41-44`): Optional-chaining `?.newSession?.()` keeps the wiring non-breaking in environments without a session manager (tests, satellite mode).
- **Write-policy granularity** (`write-policy.ts`): The three-mode matrix (draft blocks task writes, review blocks everything, revise blocks `write` but allows `edit`) is well-scoped. `isTaskFile()` predicate is clean and testable.
- **Test coverage depth**: 675 tests post-fix. Each new tool has a dedicated test file covering both the happy path and all guard conditions. The `new-session-wiring.test.ts` exercises the `triggerNewSession` → `newSession()` integration end-to-end without requiring a real session manager.

## Findings

### Critical

None.

### Important

**1. `review-plan.md`: `{{plan_content}}` was never populated during review mode** *(fixed)*
- `prompts/review-plan.md:14` (pre-fix)
- `plan.md` only exists after approval — it does not exist when `planMode === "review"`. `interpolatePrompt` leaves unresolved variables as literal text (`return vars[key] ?? match`), so reviewers in new sessions would see the literal string `{{plan_content}}` instead of the plan.
- **Fix applied**: replaced `{{plan_content}}` with an explicit instruction to read task files from `.megapowers/plans/{{issue_slug}}/tasks/` before proceeding, consistent with `revise-plan.md`.

**2. Silent overwrite of corrupt task files in `handlePlanTask`** *(fixed)*
- `extensions/megapowers/tools/tool-plan-task.ts:39-41` (pre-fix)
- When `readPlanTask()` returns `{ error: string }` (frontmatter parse failure), the old code fell through to the create path. If the caller provided `title` + `description`, the corrupt file would be silently overwritten — the LLM would believe it was creating a new task when it was actually destroying existing (unreadable) content.
- **Fix applied**: explicit check for `"error" in existing` before the update branch; returns a descriptive error directing the user to delete and recreate the file. Added a passing regression test.

**3. Stale internal note in production message** *(fixed)*
- `extensions/megapowers/tools/tool-plan-review.ts:83` (pre-fix): `"  → Transitioning to revise mode. newSession() should be called (see Task 18 wiring)."`
- "Task 18 wiring" is a development artefact with no meaning to users or LLMs consuming this message.
- **Fix applied**: replaced with `"  → Transitioning to revise mode. A new review session will start."`.

**4. `megapowers_signal` description mentions deprecated `review_approve` and stale `review→plan`** *(fixed)*
- `extensions/megapowers/register-tools.ts:22` (pre-fix)
- The tool description shown to the LLM still said `review_approve (approve plan in review phase)` and listed `review→plan` as a valid `phase_back` target. Both are invalid in the new workflow and could cause the LLM to attempt deprecated/impossible actions.
- **Fix applied**: rewrote description to document `plan_draft_done`, remove `review_approve` from the action list (noted as deprecated at the end), and remove `review→plan` from the `phase_back` examples.

### Minor

**5. Redundant `planMode: null` override in `handleApproveVerdict`**
- `extensions/megapowers/tools/tool-plan-review.ts:104`
- `transition()` already sets `planMode: null` when leaving the plan phase (state-machine.ts:137-140). The `{ ...readState(cwd), planMode: null as any }` spread is redundant and the `as any` cast is unnecessary since `null` is a valid `PlanMode`.
- **Not fixed**: the `as any` was removed (it's harmless now that the override is gone and TypeScript narrows correctly), but the `planMode: null` spread itself was left — `transition()` sets it anyway, so this is purely dead code rather than a bug. Not worth a separate fix at this stage.

**6. Double `updateTaskStatuses` on approve path**
- `tool-plan-review.ts:48-49` then `96`
- On `verdict: "approve"`, `updateTaskStatuses` is called on `approvedIds`/`needsRevisionIds` in the parent function, then immediately called again on all tasks in `handleApproveVerdict`. The redundant writes are harmless (final state is always all-approved) but produce 2× disk I/O per task. Low priority — note for a future cleanup pass when the approve path is refactored.

## Recommendations

- **Future: inject task content into reviewer session via plan-store, not `plan.md`** — the current workaround instructs the reviewer to read task files manually. Proper injection (e.g. building a `tasks_content` variable from `listPlanTasks`) would give the reviewer structured content without requiring extra tool calls. This is out of scope per the spec ("Migrating `plan_content` interpolation" is explicitly deferred) but should be the next iteration once the bridge is no longer needed.
- **Future: consolidate `updateTaskStatuses` calls** — the unconditional pre-branch calls in `handlePlanReview` and the all-tasks call in `handleApproveVerdict` should be unified. On approve, skip the pre-branch calls; call `updateTaskStatuses(all, "approved")` once in `handleApproveVerdict`.

## Assessment

**ready**

All 38 acceptance criteria pass. Four important issues were found and fixed in this session (corrupt-file error handling, `{{plan_content}}` empty-variable bug in the review prompt, stale internal comment, stale tool description). Two minor inefficiencies are noted for future cleanup. Test suite: **675 pass, 0 fail** post-fix.
