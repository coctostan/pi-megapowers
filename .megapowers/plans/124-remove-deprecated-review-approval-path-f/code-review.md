# Code Review — Issue #124: Remove Deprecated review_approve Path

## Files Reviewed

| File | Changes |
|------|---------|
| `extensions/megapowers/commands.ts` | Removed `handleReviewCommand` function (15 lines) |
| `extensions/megapowers/index.ts` | Removed `/review` command registration and `handleReviewCommand` import |
| `extensions/megapowers/prompt-inject.ts` | Added `suppressDerivedToolInstructions` guard for plan review mode |
| `extensions/megapowers/register-tools.ts` | Removed `review_approve` from tool schema union and description |
| `tests/mp-existing-commands.test.ts` | Rewrote to assert `/review` is absent and deprecated wiring removed |
| `tests/prompt-inject.test.ts` | Added test for review mode routing through `megapowers_plan_review` |
| `tests/tool-signal.test.ts` | Added test ensuring `review_approve` not advertised in tool schema |

## Strengths

- **Surgical removal**: Changes are minimal and precisely scoped. Only the active surfaces are touched — tool schema, command registration, prompt injection — with no collateral changes.
- **Regression guards are source-level** (`tool-signal.test.ts:711-715`, `mp-existing-commands.test.ts:16-19`): Tests read actual source files to assert `review_approve` doesn't creep back into the schema or commands. This is a robust pattern for preventing re-introduction.
- **`suppressDerivedToolInstructions` in `prompt-inject.ts:229-231`**: Clean boolean extraction with a clear variable name. Prevents the dead `needsReviewApproval` branch from ever accidentally firing during plan review, even if someone later adds `needsReviewApproval: true` to a phase config.
- **Deprecation error preserved** (`tool-signal.ts:232-237`): Stale callers get an actionable error message pointing to the replacement, rather than a silent failure or crash.
- **Test in `prompt-inject.test.ts:94-100`**: Verifies the actual injected prompt content routes through `megapowers_plan_review` and doesn't contain the old `phase_next` advancement instructions — testing behavior, not implementation.

## Findings

### Critical
None.

### Important
None.

### Minor

1. **Dead code: `tool-instructions.ts:24-32`** — The `needsReviewApproval` branch still contains `review_approve` instructions. This is unreachable (no phase sets the flag) and explicitly out-of-scope per the spec. The `workflow-configs.test.ts:291` test guards against it becoming reachable. A future cleanup issue could remove this dead branch and the `needsReviewApproval` type field together. Not blocking.

## Recommendations

- Consider a follow-up issue to remove the dead `needsReviewApproval` code path in `tool-instructions.ts` and the corresponding type field in `types.ts:73`. This is purely cosmetic cleanup and not urgent.

## Assessment

**ready**

The changes are clean, minimal, well-tested, and correctly scoped. All active surfaces have been updated, regression tests guard against re-introduction, and the deprecation fallback is preserved. No issues requiring fixes before merge.
