## Coverage Summary
- Overall: covered
- Planning input: spec.md

## AC-by-AC Findings
- AC 1 — covered
  - Tasks: 5
  - Finding: Task 5 switches `/issue list` to `ctx.ui.custom()` and provides test proving widget opens instead of picker.
- AC 2 — covered
  - Tasks: 1
  - Finding: Task 1 builds grouped rows with same milestone grouping semantics via `buildIssueListRows`.
- AC 3 — covered
  - Tasks: 1
  - Finding: Task 1 inserts milestone header rows above each group with `formatMilestoneHeader`.
- AC 4 — covered
  - Tasks: 1, 2
  - Finding: Task 1 sets `focusable: false` on milestone rows; Task 2 navigation skips non-focusable rows.
- AC 5 — covered
  - Tasks: 1
  - Finding: Task 1 appends `{ kind: "create", label: "+ Create new issue..." }` as final row.
- AC 6 — covered
  - Tasks: 2
  - Finding: Task 2 implements `moveIssueListCursor` with `up`/`down` keys covering actionable rows including create.
- AC 7 — covered
  - Tasks: 2
  - Finding: Task 2 handles Tab key via same `moveIssueListCursor` function (forward navigation).
- AC 8 — covered
  - Tasks: 2
  - Finding: Task 2 `renderIssueListScreen` adds `"> "` prefix to focused row for visual cursor.
- AC 9 — covered
  - Tasks: 1
  - Finding: Task 1 `formatIssueRowLabel` includes `[${issue.status}]` badge in row label.
- AC 10 — covered
  - Tasks: 1
  - Finding: Task 1 adds `● active` marker to row label when `issue.slug === activeIssueSlug`.
- AC 11 — covered
  - Tasks: 5
  - Finding: Task 5 test verifies Escape calls `done(null)` with no state mutation.
- AC 12 — covered
  - Tasks: 6
  - Finding: Task 6 routes `result.type === "create"` to `handleIssueCommand(ctx, state, store, "new")`.
- AC 13 — covered
  - Tasks: 3, 5
  - Finding: Task 3 defines action menu items; Task 5 opens menu on Enter via `view = { screen: "menu", ... }`.
- AC 14 — covered
  - Tasks: 3
  - Finding: Task 3 `buildIssueActionItems` returns base items `["Open/Activate", "Archive", "View"]` for all issues.
- AC 15 — covered
  - Tasks: 3
  - Finding: Task 3 adds `{ key: "close", label: "Close" }` when `issue.slug !== activeIssueSlug`.
- AC 16 — covered
  - Tasks: 3
  - Finding: Task 3 adds `close-now` and `go-to-done` items when `issue.slug === activeIssueSlug`.
- AC 17 — covered
  - Tasks: 7
  - Finding: Task 7 routes `action === "open"` through full state reset including `getFirstPhase`, `writeState`, `updateIssueStatus`, matching old activation path.
- AC 18 — covered
  - Tasks: 8
  - Finding: Task 8 calls `store.archiveIssue` with same reset behavior as `/issue archive` subcommand.
- AC 19 — covered
  - Tasks: 4, 5
  - Finding: Task 4 defines `openIssueDetailView` returning `{ screen: "detail", issue, returnCursor }`; Task 5 widget handles View action in-widget.
- AC 20 — covered
  - Tasks: 4
  - Finding: Task 4 `renderIssueDetailScreen` renders full issue fields (id, title, type, status, milestone, description).
- AC 21 — covered
  - Tasks: 4, 5
  - Finding: Task 4 defines `returnToListView` restoring prior cursor; Task 5 widget handles Backspace/Escape to return.
- AC 22 — covered
  - Tasks: 9
  - Finding: Task 9 routes `action === "close"` for non-active issues to `updateIssueStatus` only (no state reset).
- AC 23 — covered
  - Tasks: 9
  - Finding: Task 9 routes `action === "close-now"` to `updateIssueStatus` plus full state reset (same as immediate-close).
- AC 24 — covered
  - Tasks: 9
  - Finding: Task 9 routes `action === "go-to-done"` through `handleSignal(ctx.cwd, "phase_next", "done")`.
- AC 25 — covered
  - Tasks: 5, 6, 7, 8, 9
  - Finding: Each task explicitly reuses existing behavior: Task 5 preserves grouping/sorting, Task 6 routes to existing new-issue flow, Tasks 7-9 reuse activation/archive/close paths.
- AC 26 — covered
  - Tasks: 1, 2
  - Finding: Task 1 pure test covers row-building with milestone headers, grouping, create row; Task 2 pure test covers navigation skipping non-focusable rows.
- AC 27 — covered
  - Tasks: 2, 3, 4, 5
  - Finding: Task 2 tests navigation; Task 3 tests action-menu availability; Task 4 tests detail view; Task 5 integration test covers full keyboard flow including Escape dismiss and menu interactions.

## Missing Coverage
None

## Weak Coverage / Ambiguities
None

## Notes for the Main Reviewer
- AC 25 is a cross-cutting regression constraint covered by tasks 5-9 explicitly reusing existing code paths; verify no inadvertent flow changes.
- Task dependency chain is linear 1→(2,3,4)→5→6→7→8→9; integration comes late; early task failures block downstream tasks.
- Task statuses show only 1 and 3 approved; tasks 2, 4-9 need_revision, but coverage itself is complete.
