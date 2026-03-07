---
id: 14
title: Document AC13 squash-failure stop coverage mapping
status: approved
depends_on:
  - 7
  - 9
no_test: true
files_to_modify:
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md
files_to_create: []
---

### Task 14: Document AC13 squash-failure stop coverage mapping [depends: 7, 9] [no-test]

**Covers:** AC13

**Justification:** Plan-coverage clarification only. AC13 behavior is implemented in Task 7 (`step: "squash"` on squash failure) and consumed in Task 9 orchestration (`pushed: false` early return). This task documents that linkage explicitly.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`

**Step 1 — Add explicit AC13 mapping note in Task 7**
State that squash failure returns a targeted squash error and does not continue to push.

**Step 2 — Add explicit orchestration stop note in Task 9**
State that when `squashAndPush()` returns `step: "squash"`, `shipAndCreatePR()` returns with `pushed: false` and does not invoke PR creation.

**Step 3 — Verification command**
Run:
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
Expected: AC13 mapping appears explicitly in both tasks.
