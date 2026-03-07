# Bugfix Summary: Remove T1 Dead Code (#111)

## Issue
**Slug:** 111-plan-review-recovery-remove-t1-dead-code  
**Type:** bugfix (batch, closes #101)

## Root Cause

Issue #110 (commit `0ec65b9`) intentionally disconnected the T1 model-lint gate from runtime by removing the `completeFn` parameter from `handlePlanDraftDone`, deleting `buildLintCompleteFn` from `register-tools.ts`, and removing the model-lint import. It deliberately left the T1 module, prompt, and tests in place, deferring deletion to issue #101.

This left four dead assets in the codebase:

1. `extensions/megapowers/validation/plan-lint-model.ts` — dead module with zero callers
2. `prompts/lint-plan-prompt.md` — prompt loaded only by the dead module
3. `tests/plan-lint-model.test.ts` — 8 tests exercising the dead module
4. `tests/tool-signal.test.ts` lines 865-905 — orphaned test block passing a `failFn` to `handlePlanDraftDone` via `as any`; silently ignored since the parameter was removed

## Fix Approach

Delete the three dead files outright and replace the orphaned test block with four structural regression tests that enforce the deletions permanently.

**Files deleted:**
- `extensions/megapowers/validation/plan-lint-model.ts`
- `prompts/lint-plan-prompt.md`
- `tests/plan-lint-model.test.ts`

**Files modified:**
- `tests/tool-signal.test.ts` — removed orphaned `handlePlanDraftDone — no T1 model gating` block; added `T1 dead code removal verification` describe block with 4 regression tests

## Verification

All 6 acceptance criteria confirmed:
1. `plan-lint-model.ts` — deleted ✓
2. `lint-plan-prompt.md` — deleted ✓
3. `plan-lint-model.test.ts` — deleted ✓
4. Orphaned test block removed ✓
5. `grep` for T1 symbols returns only negative assertions ✓
6. `bun test` — 893 pass, 0 fail ✓

## How to Verify the Fix

```bash
# Files do not exist
ls extensions/megapowers/validation/plan-lint-model.ts  # should fail
ls prompts/lint-plan-prompt.md                           # should fail
ls tests/plan-lint-model.test.ts                         # should fail

# No runtime imports
grep -rn "plan-lint-model\|lintPlanWithModel\|buildLintPrompt\|ModelLintResult" extensions/ tests/ --include="*.ts"
# Only negative assertions should appear

# Tests pass
bun test
```

## Impact

- Removes ~200 lines of dead production code and 8 dead tests
- Replaces 1 phantom test with 4 regression tests enforcing the deletion
- Net test count change: -9 dead tests + 4 regression tests = -5
- Risk: none — all deleted code had zero callers
