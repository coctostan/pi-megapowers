# Bugfix Summary — #110: Disable T1 Authority / Restore Plan Review Recovery

**Issues closed:** #096, #099, #100  
**Branch:** `fix/110-plan-review-recovery-disable-t1-authorit`

---

## Root Cause

Issue `#092` shipped two entangled architectural changes that degraded plan review quality:

1. **`handlePlanDraftDone()` became a model-gated transition.** Instead of simply switching `planMode` to `"review"`, it called `lintPlanWithModel()` (T1) and blocked the state transition when T1 returned `verdict: "fail"`. This inserted a nondeterministic, fail-open pre-review gate before the reviewer ever saw the plan.

2. **`prompts/review-plan.md` was rewritten to trust T0/T1 as authoritative.** The prompt told the reviewer that T0 and T1 had already caught mechanical issues — so they should focus only on higher-order concerns. In reality, T0 only checks narrow structural properties (title, description length, file targets), and T1 is probabilistic + fail-open. The prompt's assumption was false.

Both changes were wired together: `register-tools.ts` built a `buildLintCompleteFn()` and passed it into `handlePlanDraftDone(ctx.cwd, completeFn)`, and the tests were updated to encode T1 blocking as the expected contract.

---

## Fix Approach

Three targeted changes, one per source issue:

### #096 — `prompts/review-plan.md`
Replaced the T0/T1-authoritative paragraph with:
> "Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval. You still own the full review verdict. Re-check coverage, dependency ordering, TDD completeness, self-containment, and codebase realism yourself before approving or requesting revisions."

Also updated the Self-Containment section to clarify that earlier structural checks are hints only, not guarantees.

### #099 — `extensions/megapowers/tools/tool-signal.ts`
Restored `handlePlanDraftDone()` to a simple transition:
- Validates `phase === "plan"` and `planMode` is `draft` or `revise`
- Checks that task files exist
- Writes `planMode: "review"`
- Returns `triggerNewSession: true`

Removed: `lintPlanWithModel` call, `completeFn` parameter, `deriveAcceptanceCriteria` import, T1 error message plumbing.

### #100 — `extensions/megapowers/register-tools.ts`
- Deleted `buildLintCompleteFn()` helper
- Removed unused imports: `complete` from `@mariozechner/pi-ai`, `CompleteFn` from `plan-lint-model.js`, `ModelRegistry` from pi
- Changed `plan_draft_done` dispatch to call `handlePlanDraftDone(ctx.cwd)` directly with no second argument

---

## Files Changed

| File | Change |
|------|--------|
| `prompts/review-plan.md` | Replaced T0/T1-authoritative wording with advisory-only framing; reviewer owns full verdict |
| `extensions/megapowers/tools/tool-signal.ts` | Removed T1 gating from `handlePlanDraftDone()`; function is now a simple transition |
| `extensions/megapowers/register-tools.ts` | Deleted `buildLintCompleteFn()`; removed T1 imports; calls `handlePlanDraftDone(ctx.cwd)` directly |
| `tests/prompt-inject.test.ts` | Added test asserting advisory-only wording is present and T0/T1-authoritative wording is absent |
| `tests/tool-signal.test.ts` | Replaced T1-blocking tests with "no T1 model gating" regression test; verifies failFn is ignored |
| `tests/register-tools.test.ts` | Added source-level assertion that `buildLintCompleteFn` and T1 imports are absent |

---

## Verification

- **Test suite:** 898/898 pass, 0 fail
- **Bug reproduction:** Test at `tool-signal.test.ts:865–905` passes a `failFn` returning `{ verdict: "fail" }` and confirms `planMode` transitions to `"review"` regardless — the original blocking behavior is gone
- **All 4 acceptance criteria:** verified individually with code inspection + test output (see `verify.md`)

---

## How to Verify the Fix

```bash
bun test
# Expected: 898 pass, 0 fail

bun test tests/tool-signal.test.ts -t "ignores failing model lint input"
# Expected: PASS — transition succeeds even when a fail completeFn is provided

grep -n "T1\|T0\|already passed" prompts/review-plan.md
# Expected: only lines asserting advisory/hint status, no "already passed T0/T1" claims

grep -n "buildLintCompleteFn\|lintPlanWithModel" extensions/megapowers/register-tools.ts extensions/megapowers/tools/tool-signal.ts
# Expected: no output
```
