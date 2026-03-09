---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 3
  - 2
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
approved_tasks:
  - 1
  - 3
needs_revision_tasks:
  - 2
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
---

### Per-Task Assessment

### Task 1: Build grouped issue-list rows for the custom widget — ✅ PASS
No issues.

### Task 2: Add cursor navigation and focused-row rendering — ❌ REVISE
- Coverage mapping is incorrect: it claims AC 20, but AC 20 is detail-screen content, not navigation.
- Update the `Covers AC` line so this task only claims AC 4, 6, 7, 8, 26, 27.

### Task 3: Define per-issue action menus for active and non-active rows — ✅ PASS
No issues.

### Task 4: Add in-widget detail view rendering and return state — ❌ REVISE
- Step 1 test is syntactically broken: `theme` is missing, `rendered` is referenced before definition, and the task text loses the normal step structure.
- Step 2 expected failure is not credible while Step 1 is malformed; the first failure would be a parse error, not a missing export.
- Step 3 omits the actual `openIssueDetailView()` function declaration, so the implementation snippet is incomplete.
- This task does cover AC 19/20/21, but it must be rewritten into a valid five-step TDD task.

### Task 5: Switch `/issue list` to `ctx.ui.custom()` and preserve Escape dismiss — ❌ REVISE
- Granularity is too broad: the single test exercises Escape dismiss, create-row activation, menu opening, active/non-active menu differences, detail flow, and return flow in one task.
- Step 3 is far beyond a minimal implementation; it bundles the entire widget orchestration and list-command wiring in one shot.
- Coverage mapping is too broad for the task title: AC 12 should stay with Task 6, not Task 5.
- Narrow this task to the widget shell and custom UI swap; leave downstream action routing to Tasks 6-9.

### Task 6: Route the create row into the existing new-issue flow — ❌ REVISE
- Step 3 calls `showIssueListUI(ctx as any, rows)` with the wrong arity.
- Task 5 establishes the signature as `showIssueListUI(ctx, rows, activeIssueSlug)`, so this task must pass `state.activeIssue`.

### Task 7: Route Open/Activate through the existing activation path — ❌ REVISE
- Dependency ordering is insufficient: this task edits the same `/issue list` result-handling block as Task 6 but depends only on Task 5.
- It should depend on Task 6 so the create-row handler is present first and preserved.

### Task 8: Route Archive through the existing archive behavior — ❌ REVISE
- Dependency ordering is insufficient: this task edits the same result-handling block as Tasks 6 and 7 but depends only on Task 5.
- It should depend on Task 7 so prior result handlers are available and preserved.

### Task 9: Route close actions through existing state and phase behavior — ❌ REVISE
- Dependency ordering is insufficient: this task edits the same result-handling block as Tasks 6-8 but depends only on Task 5.
- Granularity is too coarse: one `it(...)` body covers three distinct behaviors (`close`, `close-now`, `go-to-done`). Split those into focused tests in the same file.
- Step 3 should explicitly extend the existing create/open/archive result handlers rather than implying a replacement block.

### Missing Coverage
- None. All acceptance criteria have at least one planned task, but several tasks need correction before the plan is implementation-ready.

### Verdict
- **revise** — Tasks 2, 4, 5, 6, 7, 8, and 9 need adjustment for accurate AC mapping, valid TDD steps, correct function signatures, and safe dependency ordering.

I wrote prescriptive handoff instructions to `.megapowers/plans/117-interactive-issue-list-with-keyboard-nav/revise-instructions-2.md`.
