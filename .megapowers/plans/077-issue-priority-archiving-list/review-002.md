---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 6
  - 4
  - 5
  - 7
approved_tasks:
  - 1
  - 2
  - 3
  - 6
needs_revision_tasks:
  - 4
  - 5
  - 7
---

### Per-Task Assessment

### Task 1: Add archived status parsing and separate active/archive issue queries — ✅ PASS
No blocking issues. Coverage for AC1–AC3 is explicit, dependency is correct, and TDD steps are complete with valid Bun commands and file paths.

### Task 2: Add store archive operation for successful moves and metadata — ✅ PASS
No blocking issues. Covers AC14–AC22 with concrete assertions. Dependency on Task 1 is correct. Implementation APIs (`writeFileSync`, `rmSync`, `formatIssueFile`) match codebase conventions.

### Task 3: Return clear archive errors for missing and already archived issues — ✅ PASS
No blocking issues. Covers AC23–AC24 with precise expected error strings. Depends correctly on Task 2 and uses realistic `archiveIssue()` control flow.

### Task 4: Add pure active-issue sorting grouping and triage filtering helpers — ❌ REVISE
- **Granularity issue:** Step 1 bundles multiple independent behaviors (sorting, grouping, formatting, triage filtering) into one test case, making Step 2 failure ambiguous.
- **TDD quality issue:** Step 2 expected failure is too brittle for a multi-assertion test and may not be the first/actual failure once assertions are reordered.
- Requires split focused tests in the same task file and updated deterministic Step 2 failure expectation.

### Task 5: Use grouped active issues in issue list and add archived view subcommand — ❌ REVISE
- **Self-containment issue:** Step 3 provides disconnected snippets without explicit insertion points in `handleIssueCommand()`, making integration ambiguous for implementers.
- **Code realism issue:** Header-row guard (`choice.startsWith("M") || choice.startsWith("none:")`) is heuristic and should rely on ID parsing instead.
- Keep list-vs-archived visibility assertions explicit in Step 1 while clarifying integration order.

### Task 6: Add issue archive subcommand with active-state reset behavior — ✅ PASS
No blocking issues. Dependency chain is valid (`2,3,5`), TDD cycle is complete, and state reset behavior is implemented with existing APIs (`createInitialState`, `writeState`).

### Task 7: Exclude archived issues from idle prompt open-issues summary — ❌ REVISE
- **Dependency ordering issue:** Declared dependencies are over-constrained (`[1,2,5]`) but implementation only needs Task 1.
- Update frontmatter + heading depends annotation to `[1]` to avoid unnecessary sequencing constraints.

### Missing Coverage
None. All AC1–AC30 are covered by at least one task.

### Verdict
revise — Tasks 4, 5, and 7 need targeted fixes for granularity/self-containment/dependency correctness before implementation.
