---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 5
  - 6
  - 4
  - 7
approved_tasks:
  - 1
  - 2
  - 3
  - 5
  - 6
needs_revision_tasks:
  - 4
  - 7
---

## Review Summary

5 of 7 tasks pass all criteria. 2 tasks need revision.

### Task 1: Add archived status parsing and separate active/archive issue queries — ✅ PASS
Clean refactoring with correct TDD cycle.

### Task 2: Add store archive operation — ✅ PASS
Implementation and test are correct. rmSync import is properly shown (task-quality-reviewer concern was unfounded).

### Task 3: Return clear archive errors — ✅ PASS
Guard logic correctly checks archived dir before active dir. Expected failure is accurate.

### Task 4: Add pure active-issue sorting/grouping/triage helpers — ❌ REVISE
**Test assertion bug:** `filterTriageableIssues` preserves input order (uses `.filter()` only). Input order is `[4,2,1,3,5]`, after filtering out id 5 the result is `[4,2,1,3]`, but the test expects `[1,2,3,4]`. Fix: `expect(triageable.map(i => i.id)).toEqual([4, 2, 1, 3])`.

### Task 5: Use grouped active issues in list + archived view — ✅ PASS
Correct TDD cycle. Minor cosmetic double-`[archived]` in formatArchivedIssueList doesn't affect tests.

### Task 6: Add issue archive subcommand with active-state reset — ✅ PASS
State reset logic is correct. createInitialState import set up by Task 5.

### Task 7: Exclude archived issues from idle prompt — ❌ REVISE
Two issues:
1. **Missing dependency:** Test uses `store.archiveIssue()` from Task 2 but `depends_on` is `[1, 5]` — should be `[1, 2, 5]`.
2. **Broken TDD cycle:** After Task 2, `archiveIssue()` moves files to archive dir. `store.listIssues()` only reads active dir, so the test passes BEFORE the implementation change. No RED→GREEN cycle. Fix: create an archived-status issue directly in the active directory via `writeFileSync` instead of using `archiveIssue()`.

### Missing Coverage
None — all 30 ACs covered.

See `.megapowers/plans/077-issue-priority-archiving-list/revise-instructions-1.md` for detailed fixes.
