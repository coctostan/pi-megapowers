---
id: 11
title: Document AC12 squash guarantee coverage mapping
status: approved
depends_on:
  - 7
no_test: true
files_to_modify:
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md
files_to_create: []
---

### Task 11: Document AC12 squash guarantee coverage mapping [depends: 7] [no-test]

**Covers:** AC12

**Justification:** Plan-coverage clarification only. AC12 implementation and tests already live in Task 7 + existing `tests/branch-manager.test.ts`; this task makes that mapping explicit for reviewers.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`

**Step 1 — Add explicit AC12 mapping note**
In Task 7 text, explicitly state that `squashBranchToSingleCommit()` + `squashAndPush()` enforce AC12 (single clean squash commit before push).

**Step 2 — Verify mapping consistency**
Confirm Task 7 still points to the squash-specific tests in `tests/branch-manager.test.ts`.

Expected: PASS — AC12 is explicitly mapped to implementation + tests.

**Step 3 — Verification command**
Run: `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-007.md`
Expected: AC12 mapping note present and unambiguous.
