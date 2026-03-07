---
id: 17
title: Document AC18 non-main base validation coverage mapping
status: approved
depends_on:
  - 9
  - 15
  - 16
no_test: true
files_to_modify:
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md
  - .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-015.md
files_to_create: []
---

### Task 17: Document AC18 non-main base validation coverage mapping [depends: 9, 15, 16] [no-test]
**Covers:** AC18

**Justification:** Plan-coverage clarification only. Task 16 captures a non-feature `baseBranch`, Task 9 now exercises the validate short-circuit for a captured non-main base branch, and Task 15 adds the real-git shipped-history regression. This task makes that linkage explicit without inventing a redundant post-implementation TDD task.

**Files:**
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
- Modify: `.megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-015.md`

**Step 1 — Add explicit Task 16 → Task 9 linkage note**
In Task 9 text, state that the validate short-circuit tests include a captured non-main base branch case representing Task 16's persisted `baseBranch`.

**Step 2 — Add explicit AC18 mapping note in Task 15**
In Task 15 text, state that the real-git regression complements the unit suites by proving the shipped remote history collapses to one clean commit with final file content present.

**Step 3 — Verification command**
Run:
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-009.md`
- `read .megapowers/plans/093-vcs-lifecycle-audit-clean-commit-strateg/tasks/task-015.md`
Expected: AC18 coverage mapping is explicit and there is no standalone redundant post-implementation regression task.
