---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
approved_tasks:
  - 1
  - 2
  - 3
needs_revision_tasks:
  - 4
  - 5
---

### Task 1: Update revise-plan.md to use {{revise_instructions}} template variable — ✅ PASS
- Good [no-test] justification (prompt-only).
- Includes concrete edit and a verification command.
- Covers AC8.

### Task 2: Update review-plan.md to use {{plan_iteration}} template variable — ✅ PASS
- Good [no-test] justification (prompt-only).
- Clear replacements + verification command.
- Covers AC9.

### Task 3: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan — ✅ PASS
- Test and implementation align with the real codebase (`interpolatePrompt` leaves unknown vars as `{{...}}`).
- Correct dependency on Task 2.
- Covers AC4.

### Task 4: Populate vars.revise_instructions from file when planMode is revise — ❌ REVISE
- AC3 is not actually tested: draft mode loads `write-plan.md`, which doesn’t render `{{revise_instructions}}`, so the proposed assertion can pass even if `vars.revise_instructions` is incorrectly populated.
- Implementation as written only sets `vars.revise_instructions` when `store` is present; given `interpolatePrompt()` behavior, revise mode should proactively set `revise_instructions` to "" (AC2) to avoid leaking the literal `{{revise_instructions}}` token.
- See revise-instructions-1.md for exact replacement test + implementation block.

### Task 5: Gate revise verdict on revise-instructions file existence in handlePlanReview — ❌ REVISE
- AC6 requires the error to include the expected filename *and the full path*. The proposed test and error message only assert/include a relative path.
- Update both test + implementation to include the computed absolute `filepath` in the error.
- Ensure existing `verdict: "revise"` tests create the required file after this gate is added.
- See revise-instructions-1.md for concrete snippets.

### Missing Coverage
None — AC1-AC9 are all mapped to tasks.

Revise instructions have been written to:
`.megapowers/plans/082-reviewer-authored-revise-instructions-ha/revise-instructions-1.md`
