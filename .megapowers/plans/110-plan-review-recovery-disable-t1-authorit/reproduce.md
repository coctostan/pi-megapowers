# Reproduction: plan review is still partially delegated to T1/model lint and the reviewer prompt treats T0/T1 as authoritative

## Steps to Reproduce
1. Inspect `prompts/review-plan.md`.
2. Read the reviewer instructions at line 19 and the self-containment note at line 52.
3. Create a plan-phase workspace with at least one task and a spec, then call `handlePlanDraftDone()` with a model completion function that returns a failing T1 result.
4. Observe that `handlePlanDraftDone()` returns an error and does **not** switch `planMode` to `review`.
5. Call `handlePlanDraftDone()` again with a malformed/non-JSON model response.
6. Observe that the malformed T1 response is treated as pass-with-warning and the plan still transitions to review.
7. Inspect `extensions/megapowers/register-tools.ts` and observe that `megapowers_signal(plan_draft_done)` always builds and passes a T1 `completeFn` into `handlePlanDraftDone()`.

## Expected Behavior
- `plan_draft_done` should only validate phase/mode, verify that task files exist, and transition the plan to review mode.
- The reviewer prompt should treat any prior deterministic/model checks as advisory only.
- The reviewer should still own the full verdict, including coverage, dependencies, TDD completeness, self-containment, and codebase realism.
- There should be no hidden model-dependent pre-review gate and no fail-open/fail-closed behavior based on T1 model output.

## Actual Behavior
`prompts/review-plan.md` currently tells the reviewer:

> "The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1). Mechanical issues — empty descriptions, missing file targets, placeholder text, spec coverage gaps, dependency ordering — have been caught and fixed. **Focus your review entirely on higher-order concerns:** code correctness, architectural soundness, and implementation feasibility."

It also says:

> "(Structural completeness — file paths, non-empty descriptions — is already verified by T0 lint.)"

`handlePlanDraftDone()` still performs T1 lint before review-mode transition. In a minimal repro, a failing T1 response blocks review entirely with this exact error:

```text
FAIL_RESULT={"error":"❌ T1 plan lint failed:\n  • AC1 is not covered by any task"}
PLAN_MODE_AFTER_FAIL=draft
```

A malformed T1 response does the opposite: it fail-opens and still transitions to review:

```text
MALFORMED_RESULT={"message":"📝 Draft complete: 1 task saved\n  → Transitioning to review mode.\n  ⚠️ T1 lint response was malformed — treating as pass (fail-open).","triggerNewSession":true}
PLAN_MODE_AFTER_MALFORMED=review
```

So the current behavior is both:
- **authoritative/fail-closed** when T1 returns findings, and
- **advisory/fail-open** when T1 malfunctions,

while the reviewer prompt simultaneously tells the human reviewer that T0/T1 already caught the mechanical/fundamental issues.

## Evidence
### Prompt evidence
`prompts/review-plan.md`
- line 19: `The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1). ... Focus your review entirely on higher-order concerns...`
- line 52: `Structural completeness — file paths, non-empty descriptions — is already verified by T0 lint.`

### Runtime evidence
`extensions/megapowers/tools/tool-signal.ts`
- lines 223-242: `handlePlanDraftDone()` branches on `completeFn`, calls `lintPlanWithModel(...)`, blocks on `!lintResult.pass`, and appends T1 warnings.
- line 238 exact error format:
  `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`
- lines 245-249: only after the T1 path completes does it write `planMode: "review"` and return `→ Transitioning to review mode.`

### Registration/wiring evidence
`extensions/megapowers/register-tools.ts`
- lines 21-46: `buildLintCompleteFn(...)` constructs a model-backed completion function.
- lines 70-72:
  - `const completeFn = await buildLintCompleteFn(ctx.modelRegistry);`
  - `result = await handlePlanDraftDone(ctx.cwd, completeFn);`

This confirms the T1 path is still wired into the public `megapowers_signal(plan_draft_done)` tool path.

### Fail-open model behavior
`extensions/megapowers/validation/plan-lint-model.ts`
- line 33: API errors become `T1 lint skipped — API error: ...`
- lines 69-72:
  - `T1 model returned fail with no findings — treating as pass.`
  - `T1 lint response was malformed — treating as pass (fail-open).`

### Test evidence already in repo
- `tests/tool-signal.test.ts:886-902` verifies that failing T1 findings block transition and leave `planMode` as `draft`.
- `tests/plan-lint-model.test.ts:37-44` verifies malformed model output is treated as pass with warning (`fail-open`).

### Recent change likely introducing the behavior
`git log -- prompts/review-plan.md extensions/megapowers/tools/tool-signal.ts extensions/megapowers/register-tools.ts`
- `6dabbd9 feat: two-tier plan validation — T0 deterministic lint + T1 model lint (#092) (#52)`

## Environment
- Repo HEAD: `18ada73`
- Recent introducing commit in touched files: `6dabbd9`
- OS: macOS `26.3` (`Darwin arm64`)
- Bun: `1.3.9`
- Project test command from `AGENTS.md`: `bun test`

## Failing Test
Not feasible yet because this reproduce pass is documenting the currently shipped prompt/runtime behavior without changing repo behavior. The desired regression tests would intentionally fail the suite until the fix lands, and they span both prompt wording and `plan_draft_done` runtime semantics. They should be added in implement once the expected behavior is locked.

## Reproducibility
Always
