---
type: plan-review
iteration: 3
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
No issues. Prompt-only change with a reasonable verification step.

### Task 2: Update review-plan.md to use {{plan_iteration}} template variable — ✅ PASS
No issues. Prompt-only change with a reasonable verification step.

### Task 3: Populate vars.plan_iteration in buildInjectedPrompt when phase is plan — ✅ PASS
Good TDD shape (RED/GREEN + full suite) and uses the correct file/API (`interpolatePrompt` via `vars` in `buildInjectedPrompt`). Dependency on Task 2 is correct because the test asserts interpolation in `review-plan.md`.

### Task 4: Populate vars.revise_instructions from file when planMode is revise — ❌ REVISE
- **Granularity:** Step 1 adds 3 distinct tests (AC1/AC2/AC3). Per project plan standards, split into separate tasks (one test + one implementation each).
- **Brittle assertion:** AC2 test asserts an exact newline sequence (`"## Reviewer's Instructions\n\n## Quality Bar"`) which will be template-formatting sensitive. Assert intent (token removed + headings present) instead.

### Task 5: Gate revise verdict on revise-instructions file existence in handlePlanReview — ❌ REVISE
- **Granularity:** Step 1 adds 3 distinct tests (missing-file error, success path, approve-no-check). Split into separate tasks.
- **Incomplete test update list:** In addition to updating `tests/tool-plan-review.test.ts`, you must update `tests/new-session-wiring.test.ts` (it calls `megapowers_plan_review` with `verdict: "revise"` and will fail once the gate is added).
- Ensure the gate is placed before any side effects (`writePlanReview`, `updateTaskStatuses`, `writeState`).

### Missing Coverage
None. All AC1–AC9 are covered by the plan as written.

### Verdict
revise — Task 4 and Task 5 need the above adjustments.

