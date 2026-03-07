---
id: 1
title: Document AC1 activation branch-recording coverage mapping
status: approved
depends_on: []
no_test: true
files_to_modify:
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-016.md
files_to_create: []
---

### Task 1: Document AC1 activation branch-recording coverage mapping [depends: none] [no-test]

**Covers:** AC1

**Justification:** Plan-coverage clarification only. AC1 behavior (record branch name on successful activation) is tested in Task 16 and existing `tests/vcs-commands.test.ts`; this task makes the mapping explicit.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-016.md`

**Step 1 — Add explicit AC1 mapping note**
In Task 16 text, explicitly state the assertion that activation success persists `branchName`.

**Step 2 — Verification command**
Run: `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-016.md`
Expected: AC1 mapping note present and references persisted `branchName` assertion.
