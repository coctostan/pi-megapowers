# Diagnosis

## Root Cause
The bug is not a runtime accident in one function; it is a shipped architectural change from commit `6dabbd9` / issue `#092` that deliberately reassigned part of plan-review authority from the reviewer to a new T1 model lint stage, then rewrote the reviewer prompt to trust that stage more than the codebase actually supports.

There are two concrete root-cause decisions:

1. **`handlePlanDraftDone()` was intentionally changed from a simple state transition into a model-gated transition.**
   - Before `6dabbd9`, `handlePlanDraftDone(cwd)` only validated phase/mode, checked that task files existed, wrote `planMode: "review"`, and returned `triggerNewSession: true`.
   - After `6dabbd9`, `handlePlanDraftDone(cwd, completeFn?)` conditionally calls `lintPlanWithModel(...)` and blocks the transition when the model returns `verdict: "fail"` with findings.
   - Evidence:
     - old code (`git show 6dabbd9^:extensions/megapowers/tools/tool-signal.ts`, around old `handlePlanDraftDone`) shows the pre-change function with no model call and immediate review transition.
     - current code `extensions/megapowers/tools/tool-signal.ts:223-245` shows the T1 branch, the `lintPlanWithModel(...)` call, and the early return on `!lintResult.pass`.
     - repo tests explicitly lock this in: `tests/tool-signal.test.ts:886-902` asserts failing T1 findings block transition and keep `planMode` as `draft`.

2. **`prompts/review-plan.md` was intentionally rewritten to assume T0/T1 already handled fundamental checks, but that assumption is false.**
   - The prompt now says the plan already passed T0 and T1, says mechanical/spec/dependency issues have been caught and fixed, and tells the reviewer to focus entirely on higher-order concerns.
   - But T0 only checks a narrow structural subset, and T1 is nondeterministic + fail-open.
   - Evidence:
     - current prompt `prompts/review-plan.md:19` says: `The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1)... Focus your review entirely on higher-order concerns...`
     - current prompt `prompts/review-plan.md:52` says structural completeness is already verified by T0.
     - `extensions/megapowers/validation/plan-task-linter.ts:8-58` shows T0 only checks: non-empty title, description length, at least one file target, `depends_on` validity/forward refs, and duplicate `files_to_create`. It does **not** verify full AC coverage, TDD correctness, API realism, self-containment, or whether a plan actually works.
     - `extensions/megapowers/validation/plan-lint-model.ts:21-37,55-73` shows T1 is model-based and fail-open on API error or malformed output.

So the confirmed root cause is: **issue `#092` introduced a hidden model-dependent pre-review gate and simultaneously downgraded the reviewer’s responsibility based on an invalid assumption that T0/T1 had already authoritatively checked fundamentals.**

## Trace
1. **Symptom:** plan review is still partially delegated to T1/model lint, and the reviewer prompt treats T0/T1 as authoritative.
2. **Where it appears in runtime:** `handlePlanDraftDone()` blocks review transition on T1 findings.
   - `extensions/megapowers/tools/tool-signal.ts:223-242`
   - The transition to review only happens after the T1 path completes (`lines 245-249`).
3. **What calls it with the model dependency:** the public `megapowers_signal(plan_draft_done)` tool path in tool registration.
   - `extensions/megapowers/register-tools.ts:21-46` builds `buildLintCompleteFn(...)`.
   - `extensions/megapowers/register-tools.ts:70-72` passes that `completeFn` into `handlePlanDraftDone(ctx.cwd, completeFn)`.
4. **Where that behavior came from:** commit `6dabbd9` intentionally added the T1 layer.
   - `.megapowers/docs/092-two-tier-plan-validation-deterministic-l.md:28-39` documents the exact new flow: build model completion fn → call `handlePlanDraftDone(cwd, completeFn)` → run model lint → block on findings → otherwise transition.
   - The same doc says `prompts/review-plan.md` was changed so mechanical checks were removed and review focused on architecture (`lines 47-55`).
5. **Why the prompt is wrong:** the prompt assumes T0/T1 did more than they actually do.
   - T0’s actual implementation (`plan-task-linter.ts`) is only structural.
   - T1’s actual implementation (`plan-lint-model.ts`) is nondeterministic and fail-open.
6. **Working baseline comparison:** before `6dabbd9`, `handlePlanDraftDone` was a simple transition with no T1 and the reviewer prompt did not claim T1/T0 had already verified those concerns.

This trace confirms the source is upstream design/wiring introduced in `#092`, not a downstream formatting bug or a single bad conditional.

## Affected Code
- `prompts/review-plan.md`
  - line 19: tells reviewer T0/T1 already caught mechanical/spec/dependency issues
  - line 52: says T0 already verified structural completeness
- `extensions/megapowers/tools/tool-signal.ts`
  - `handlePlanDraftDone()` at `210-252`
  - T1 gating path at `223-242`
  - state transition only after T1 path at `245-249`
- `extensions/megapowers/register-tools.ts`
  - `buildLintCompleteFn()` at `21-46`
  - `plan_draft_done` async dispatch at `67-75`
- `extensions/megapowers/validation/plan-lint-model.ts`
  - model lint entrypoint at `21-37`
  - fail-open parsing/error behavior at `55-73`
- `extensions/megapowers/validation/plan-task-linter.ts`
  - actual T0 scope at `8-58`
- Historical evidence
  - pre-change `handlePlanDraftDone` from `git show 6dabbd9^:extensions/megapowers/tools/tool-signal.ts`
  - pre-change `register-tools.ts` from `git show 6dabbd9^:extensions/megapowers/register-tools.ts`
- Intent/design docs
  - `.megapowers/docs/092-two-tier-plan-validation-deterministic-l.md:28-39,47-65`
  - `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md:66-80` documents the desired recovery behavior: revert `plan_draft_done` to a simple transition and restore full reviewer ownership.

## Pattern Analysis
### Working pattern
Two working patterns already exist in this codebase:

1. **Pre-`#092` `plan_draft_done` behavior**
   - validate phase/mode
   - ensure task files exist
   - switch `planMode` to `review`
   - trigger new session
   - no hidden model gate

2. **Current `megapowers_plan_review` ownership model**
   - `extensions/megapowers/tools/tool-plan-review.ts:23-70` only accepts a human/reviewer verdict in review mode.
   - The canonical approval/revise decision is made there, not by a model pre-screen.

### Broken pattern
`#092` inserted a new authority layer between drafting and review:
- `register-tools.ts` always tries to construct a model completion function
- `handlePlanDraftDone()` conditionally delegates judgment to `lintPlanWithModel()`
- `review-plan.md` tells the reviewer fundamentals were already handled

### Specific differences
1. **State transition semantics changed**
   - Before: `plan_draft_done` was a pure workflow transition.
   - After: `plan_draft_done` became a content-evaluating gate.

2. **Authority changed**
   - Before: reviewer owned the first real whole-plan verdict.
   - After: T1 can reject the plan before review even begins.

3. **Assumption mismatch**
   - Prompt assumption: T0/T1 already validated coverage/dependencies/mechanical issues.
   - Actual T0 implementation: narrow structural lint only.
   - Actual T1 implementation: probabilistic model check with fail-open behavior.

4. **Test suite encodes the wrong contract**
   - `tests/tool-signal.test.ts:865+` tests T1 integration as expected behavior.
   - `tests/plan-lint-model.test.ts:37-54` tests fail-open behavior as expected behavior.
   - So the bug persists because both code and tests were updated to support the same mistaken architecture.

### Violated assumptions
The broken code assumes:
1. T0 meaningfully guarantees more than basic structure.
2. A fast model lint is reliable enough to sit in the transition path.
3. It is safe to reduce reviewer attention once T0/T1 ran.

Evidence rejects all three:
- T0 scope is narrow and explicit in `plan-task-linter.ts`.
- T1 is intentionally fail-open in `plan-lint-model.ts`.
- The recovery doc `095...decomposition.md` explicitly calls out that reviewer ownership must be restored before any further assistance because hidden authority is the real failure mode.

## Risk Assessment
If this area is changed later, these dependents are at risk and should be reviewed:

1. **Tool registration/session behavior**
   - `register-tools.ts` owns the async `plan_draft_done` path and session restart behavior.
   - Risk: removing T1 must not regress `triggerNewSession` / `newSession()` behavior.
   - Existing protection: `tests/new-session-wiring.test.ts:29-61` verifies a successful `plan_draft_done` starts a new session.

2. **Plan-transition tests**
   - `tests/tool-signal.test.ts` currently contains both the original simple-transition tests and the T1 integration tests.
   - Risk: tests will need to be realigned to the simpler contract.

3. **Prompt expectations and prompt tests**
   - Any tests or docs that assert review should only focus on high-order concerns may become stale.
   - `tests/reproduce-084-batch.test.ts` already checks a separate review prompt behavior; prompt wording updates may require additional targeted assertions.

4. **Docs/changelog drift**
   - `.megapowers/docs/092...` and related learnings/docs describe T1 as shipped behavior.
   - The runtime can be fixed first, but documentation that still describes T1 as active will become misleading until cleaned up.

5. **Related bugs sharing the same root cause**
   - Any place where advisory automation is presented as authoritative review likely shares the same design mistake.
   - The recovery roadmap already identifies adjacent cleanup issues (`#101`, `#108`) for exactly this reason.

## Fixed When
1. `prompts/review-plan.md` no longer claims T0/T1 already verified coverage, dependency, or other mechanical/fundamental issues, and instead explicitly says earlier checks are advisory only.
2. `handlePlanDraftDone()` is back to being a simple transition: validate phase/mode, ensure task files exist, switch `planMode` to `review`, trigger a new session.
3. `extensions/megapowers/register-tools.ts` no longer builds or passes a model completion function for `plan_draft_done`.
4. Tests no longer encode T1 as part of the `plan_draft_done` contract, and still verify successful `plan_draft_done` transitions to review mode and starts a new session.
