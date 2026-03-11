# Feature: Remove Deprecated review_approve Path (#124)

## Summary
Removed the deprecated `review_approve` approval path from all active product surfaces so the plan-review flow consistently uses `megapowers_plan_review`. The low-level deprecation error in `handleSignal` is preserved for backward compatibility with stale callers.

## What Changed

### Tool Schema (`register-tools.ts`)
- Removed `Type.Literal("review_approve")` from the `megapowers_signal` action union
- Removed the "Note: review_approve is deprecated" text from the tool description

### Command Surface (`index.ts`, `commands.ts`)
- Removed `/review` command registration and its `handleReviewCommand` handler
- Removed the `handleReviewCommand` import from `index.ts`

### Prompt Injection (`prompt-inject.ts`)
- Added `suppressDerivedToolInstructions` guard: when in plan review mode, the generic derived tool instructions (artifact save + `phase_next`) are suppressed so they don't conflict with the `review-plan.md` template that correctly directs approval through `megapowers_plan_review`

### Tests
- `tests/tool-signal.test.ts` — regression guard ensuring `review_approve` is not in the tool schema while the deprecation error remains
- `tests/mp-existing-commands.test.ts` — updated to assert `/review` command and `handleReviewCommand` are absent
- `tests/prompt-inject.test.ts` — new test verifying review mode routes through `megapowers_plan_review` without conflicting `phase_next` instructions

## What's Preserved
- `handleSignal(cwd, "review_approve")` in `tool-signal.ts` still returns a clear deprecation error directing callers to `megapowers_plan_review`
- Dead code branch in `tool-instructions.ts` for `needsReviewApproval` left intact (unreachable, guarded by test)

## Test Results
799/799 tests pass, 0 failures.
