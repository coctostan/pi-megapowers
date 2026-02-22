## Strengths
- Clear separation of concerns: routing (`artifact-router.ts`), gating (`gates.ts`), prompt mapping (`prompts.ts`), parsing (`spec-parser.ts`), and UI (`ui.ts`) are each extended in the right layer.
- Bugfix workflow support is integrated consistently across state, prompts, gates, routing, and UI.
- Test coverage is broad for this slice (artifact routing, parser, gates, prompts, UI state/menu behavior), and `bun test` is fully green (307/307).

## Findings

### Critical
None.

### Important
1. **Stale acceptance criteria can persist after diagnosis edits**
   - **File:** `extensions/megapowers/artifact-router.ts:61-64`
   - **What’s wrong:** `acceptanceCriteria` is only updated when `extractFixedWhenCriteria()` returns non-empty results. If diagnosis previously had a `## Fixed When` section and is later revised to remove it, old criteria remain in state.
   - **Why it matters:** State can diverge from `diagnosis.md`, causing incorrect verify-phase tracking and misleading progress signals.
   - **How to fix:** On diagnose-phase save, explicitly set `stateUpdate.acceptanceCriteria = criteria` (including empty array), or clear criteria when section is absent.

2. **Missing integration tests for bugfix prompt variable injection path**
   - **File:** `extensions/megapowers/index.ts:152-165`, `extensions/megapowers/index.ts:207-225`
   - **What’s wrong:** Core bugfix behavior (aliasing reproduce/diagnosis into plan vars and done-mode template var population) is implemented in event wiring but not directly tested.
   - **Why it matters:** This is high-risk glue code; regressions here won’t be caught by current tests that only validate template text/menu selection.
   - **How to fix:** Add integration-style tests around `before_agent_start` to assert interpolated prompt content for bugfix `plan` and `done` modes.

### Minor
1. **Parser duplication / maintainability**
   - **File:** `extensions/megapowers/spec-parser.ts:10-35` and `44-70`
   - **What’s wrong:** `extractAcceptanceCriteria` and `extractFixedWhenCriteria` duplicate near-identical numbered-list parsing logic.
   - **Why it matters:** Future parsing tweaks can drift between functions.
   - **How to fix:** Factor shared section-list parsing into a helper (e.g., `extractNumberedCriteriaFromSection(content, headingRegex)`).

2. **Stray doc comment**
   - **File:** `extensions/megapowers/spec-parser.ts:38-41`
   - **What’s wrong:** There is an orphaned “Check if a spec has unresolved open questions” comment preceding a different function comment.
   - **Why it matters:** Small readability hit.
   - **How to fix:** Move/remove comment to align with `hasOpenQuestions`.

## Assessment
**needs-fixes**

Functionally solid and mostly well-structured, but the stale `acceptanceCriteria` state behavior is a correctness concern that should be fixed before merge; additionally, key prompt-injection glue in `index.ts` needs direct tests for production confidence.