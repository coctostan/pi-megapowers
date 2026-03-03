# Code Review: 082-reviewer-authored-revise-instructions-ha

## Files Reviewed

| File | Change |
|------|--------|
| `extensions/megapowers/prompt-inject.ts` | +10 lines — inject `plan_iteration` and `revise_instructions` into `vars` during plan phase |
| `extensions/megapowers/tools/tool-plan-review.ts` | +15 lines — add `existsSync` gate before accepting a `revise` verdict |
| `prompts/review-plan.md` | +30 lines — add "Revise-Instructions Handoff" section with example structure; update "After Review" to require file creation before calling the tool |
| `prompts/revise-plan.md` | Replaces manual file-reading instruction with `{{revise_instructions}}`; adds "Quality Bar" and "Pre-Submit Checklist" sections |
| `prompts/write-plan.md` | Adds "Quality Bar", "Read the Codebase First", "Pre-Submit Checklist"; streamlines existing rules section |
| `tests/prompt-inject.test.ts` | +71 lines — 4 new tests for plan-phase variable injection (AC1–4) |
| `tests/tool-plan-review.test.ts` | +72 lines — 4 existing tests updated to provide fixture file; 3 new dedicated gate tests (AC5–7) |
| `tests/new-session-wiring.test.ts` | +2 lines — add fixture file required by new gate to existing revise/new-session test |

---

## Strengths

- **Minimal footprint** (`prompt-inject.ts:136-143`, `tool-plan-review.ts:36-48`): the two production code changes total 24 lines and are precisely scoped — no collateral rewrites.

- **Safe non-null assertion** (`prompt-inject.ts:141`, `state.activeIssue!`): guarded by the early-return at lines 58-60 (`if (!state.activeIssue || !state.phase) return ...`), so the `!` is provably safe.

- **Empty-string fallback** (`prompt-inject.ts:142`, `content ?? ""`): `store.readPlanFile` returns `null` on file-not-found; `null ?? ""` correctly satisfies AC2. Idiomatic and correct.

- **Gate placement** (`tool-plan-review.ts:37-48`): the file-existence check happens before any state mutation, so failure is a clean early return — no partial writes.

- **Actionable error message** (`tool-plan-review.ts:43-44`): error includes both the full filesystem path (`filepath`) and the basename (`filename`), giving the caller exactly what they need to fix the issue.

- **AC3 spy test** (`tests/prompt-inject.test.ts:150`): uses a method spy to observe `store.readPlanFile` call arguments directly, rather than testing through template output. This is a more direct check of the invariant.

- **Existing tests updated correctly** (`tests/tool-plan-review.test.ts:63-72`, `85-93`, `105-112`, `123-130`; `tests/new-session-wiring.test.ts:71-72`): the new gate is a breaking change for tests that call `handlePlanReview` with `verdict: "revise"` — all four affected tests were updated to provide the fixture file. None were deleted or disabled.

- **Prompt changes are high-quality**: the Quality Bar and Pre-Submit Checklist additions to `write-plan.md` and `revise-plan.md` are concrete, actionable, and self-consistent with the review criteria in `review-plan.md`.

---

## Findings

### Critical
None.

### Important
None.

### Minor

**1. `prompt-inject.ts:139` — `{{revise_instructions}}` passes through literally if store is absent in revise mode**

```ts
if (state.planMode === "revise" && store) {   // store guard
  vars.revise_instructions = content ?? "";
}
```

If `buildInjectedPrompt` is called without `store` in revise mode, `vars.revise_instructions` is never set → `interpolatePrompt` falls back to `match` (returns `{{revise_instructions}}` literally per `prompts.ts:50`).

In practice this doesn't occur: the only production callsite is `hooks.ts:54`, which always passes `store`. Tests for AC1/AC2 also always pass `store`. But the function signature declares `store` optional, so the gap exists.

Fix (if desired): always default to empty string in revise mode regardless of store availability:
```ts
if (state.planMode === "revise") {
  const filename = `revise-instructions-${state.planIteration - 1}.md`;
  vars.revise_instructions = store?.readPlanFile(state.activeIssue!, filename) ?? "";
}
```
This is backwards-compatible and makes the behavior unconditional. Not blocking — noting for awareness.

**2. `tool-plan-review.ts:48-49` — missing blank line after gate closing brace**

```ts
    }
  }
  const approvedIds = params.approved_tasks ?? [];   // no blank line
```

The rest of the function uses blank lines to separate logical sections (e.g. lines 51-52 have a blank line before the `review` object). Cosmetic only.

**3. `tool-plan-review.ts:37-48` — gate runs even at MAX_PLAN_ITERATIONS**

When `planIteration >= MAX_PLAN_ITERATIONS`, the gate requires a `revise-instructions-N.md` file before proceeding — but `handleReviseVerdict` immediately returns the "max iterations" error regardless. The reviewer must write a file that has no practical effect.

The test at line 105 (`returns error at iteration cap`) explicitly creates the file to pass the gate, confirming this is tested behavior. It's a minor UX friction, not a bug. The gate could special-case max iterations to return early with a different error, but the current consistent behavior is acceptable.

---

## Recommendations

- The `store?` optional guard pattern is used widely in `buildInjectedPrompt` (e.g., lines 75, 125, 131, 187). Consider establishing a convention: if a variable requires file access and `store` is absent, default to `""` rather than leaving `vars[key]` undefined. This avoids the literal-token passthrough class of bug. Applies to `revise_instructions` and would be a natural follow-up.

---

## Assessment

**ready**

All 9 acceptance criteria verified, 751 tests pass. The implementation is tight, minimal, and correct. Test coverage is meaningful — spy-based for AC3, output-through-template for AC4, direct error-message assertion for AC5/AC6. The gate in `handlePlanReview` is clean and consistently positioned before mutations. Findings are all minor; none require changes before merge.
