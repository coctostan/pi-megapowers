---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
approved_tasks:
  - 1
  - 2
  - 3
needs_revision_tasks:
  - 4
---

## Per-Task Assessment

### Task 1: Add requirePlanApproved gate type and wire into workflow configs — ✅ PASS
No issues. Clean approach, correct coverage of Fixed When #1-3, all TDD steps present with full code.

### Task 2: Make extractPlanTasks accept ## headers and em-dash/hyphen separators + end-to-end deriveTasks test — ✅ PASS
No issues. Regex change is correct, end-to-end test is a good addition, all steps present.

### Task 3: Make deriveTasks prefer task files over plan.md parsing — ✅ PASS
No issues. PlanTask mapping is correct (id→index, title→description, no_test→noTest, depends_on→dependsOn). Dependency on Task 2 is correct.

### Task 4: Add plan_draft_done instruction to revise-plan.md prompt [no-test] — ❌ REVISE

Three issues:

1. **Status inconsistency:** Frontmatter has `status: draft` while Tasks 1-3 have `status: approved`. Update to `approved`.

2. **Step 2 lacks remediation instructions:** The grep audit checks for `phase_next` in prompt files but doesn't say what to do if matches are found. Add: "If any `phase_next` mentions are found in plan-phase prompts (`write-plan.md`, `revise-plan.md`, `review-plan.md`), remove them."

3. **Incomplete audit scope:** Task claims Fixed When #8 coverage ("no plan-phase prompt mentions phase_next") but should explicitly read all three plan-phase prompts (`write-plan.md`, `review-plan.md`, `revise-plan.md`) and verify content — not just grep. Add a brief "read each file and verify no misleading `phase_next` instructions exist" step for self-containment.

### Missing Coverage
None — all Fixed When criteria (#1-9) are covered across Tasks 1-4.
