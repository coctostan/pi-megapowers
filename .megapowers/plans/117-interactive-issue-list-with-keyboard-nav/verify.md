# Verification Report: 117-interactive-issue-list-with-keyboard-nav

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)
 934 pass
 0 fail
 2239 expect() calls
Ran 934 tests across 102 files. [1057.00ms]
```

Targeted tests for this feature (all pass):
```
bun test tests/ui-issue-list-rows.test.ts tests/ui-issue-list-navigation.test.ts \
         tests/ui-issue-list-actions.test.ts tests/ui-issue-list-detail.test.ts \
         tests/ui-issue-command-custom-list.test.ts tests/ui-issue-command-open-action.test.ts

 6 pass
 0 fail
 38 expect() calls
Ran 6 tests across 6 files. [62.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: Running `/issue list` opens a custom interactive widget instead of the current `ctx.ui.select()` picker.
**Evidence:** `extensions/megapowers/ui.ts` line 355: `if (typeof (ctx.ui as any).custom === "function") {` → calls `showIssueListUI(ctx as any, rows, state.activeIssue)` which calls `ctx.ui.custom<IssueListResult>(...)`. The old `ctx.ui.select()` path still exists as fallback (lines 452–480) for environments without `custom`.  
**Verdict:** pass

### Criterion 2: The widget renders issues grouped by milestone using the same grouping and ordering semantics the current issue-list flow uses.
**Evidence:** `ui.ts` line 349: `const issues = sortActiveIssues(store.listIssues().filter(i => i.status !== "done"))` — same `sortActiveIssues` function used by both old and new paths. `buildIssueListRows` then groups by `issue.milestone`. Test `ui-issue-list-rows.test.ts` verifies M1 and M2 groups appear in order.  
**Verdict:** pass

### Criterion 3: The widget renders each milestone header visibly above its group of issues.
**Evidence:** `buildIssueListRows` inserts `{ kind: "milestone", focusable: false, ... }` before each group. `renderIssueListScreen` renders milestone rows with `theme.bold(row.label)`. Test `ui-issue-list-rows.test.ts` confirms `rows[0]` is `{ kind: "milestone", label: "M1: (2 issues)" }`.  
**Verdict:** pass

### Criterion 4: Milestone header rows are not focusable and keyboard navigation skips them.
**Evidence:** `buildIssueListRows` sets `focusable: false` on all milestone rows. `moveIssueListCursor` only stops on rows where `rows[next]?.focusable` is true, skipping non-focusable headers. `findFirstFocusableRow` returns index 1 (first issue), skipping the index-0 milestone header. Verified by `ui-issue-list-navigation.test.ts`: `expect(start).toBe(1)`.  
**Verdict:** pass

### Criterion 5: The widget renders a `+ Create new issue...` row as the final actionable row after all milestone groups.
**Evidence:** `buildIssueListRows` always pushes `{ kind: "create", key: "create", label: "+ Create new issue...", focusable: true }` at the end. `ui-issue-list-rows.test.ts`: `expect(rows.at(-1)).toMatchObject({ kind: "create", focusable: true, label: "+ Create new issue..." })`.  
**Verdict:** pass

### Criterion 6: Pressing Up or Down moves focus between actionable rows in the issue list, including the create row.
**Evidence:** `handleInput` in `showIssueListUI` calls `moveIssueListCursor(rows, view.cursor, "up"/"down")`. Navigation test verifies: down from index 1 → 2 → 4 (skipping milestone at 3), and up from create back to 4. `expect(rows[create]).toMatchObject({ kind: "create" })`.  
**Verdict:** pass

### Criterion 7: Pressing Tab moves focus forward between actionable rows in the issue list, including the create row.
**Evidence:** `handleInput` in list screen: `if (matchesKey(data, Key.down) || matchesKey(data, Key.tab))` calls `moveIssueListCursor(rows, view.cursor, "down")`. Navigation test: `const tab = moveIssueListCursor(rows, down, "tab"); expect(tab).toBe(4)`.  
**Verdict:** pass

### Criterion 8: The currently focused actionable row is shown with a clear visual cursor or highlight.
**Evidence:** `renderIssueListScreen` renders `const prefix = i === cursor ? "> " : "  "` for each non-milestone row. Navigation test: `expect(rendered).toContain("> #003 [P3] C [open]")`.  
**Verdict:** pass

### Criterion 9: Each issue row shows a visual status indicator or badge representing the issue's status.
**Evidence:** `formatIssueRowLabel` includes `[${issue.status}]` in the label string. `ui-issue-list-rows.test.ts`: `expect(rows[1].label).toContain("[open]"); expect(rows[2].label).toContain("[in-progress]")`.  
**Verdict:** pass

### Criterion 10: The currently active issue is visibly marked in the list.
**Evidence:** `formatIssueRowLabel` appends `" ● active"` when `isActive` is true. `ui-issue-list-rows.test.ts`: `expect(rows[2].label).toContain("● active")`.  
**Verdict:** pass

### Criterion 11: Pressing Escape while on the issue list dismisses the widget without mutating any issue.
**Evidence:** `handleInput` (list screen): `if (matchesKey(data, Key.escape)) { done(null); return; }`. Caller in `ui.ts`: `if (!result) return state` — no mutations. `ui-issue-command-custom-list.test.ts`: `const dismissed = await driveWidget(rows, active.slug, [ESC]); expect(dismissed.result).toBeNull()`.  
**Verdict:** pass

### Criterion 12: Pressing Enter on the `+ Create new issue...` row starts the existing issue-creation flow.
**Evidence:** `handleInput` (list screen): `if (row?.kind === "create") { done({ type: "create" }); return; }`. `ui.ts` line 361: `if (result.type === "create") { return this.handleIssueCommand(ctx, state, store, "new"); }`.  
**Verdict:** pass

### Criterion 13: Pressing Enter on an issue row opens an in-widget action menu for that specific issue.
**Evidence:** `handleInput` (list screen): `if (row?.kind === "issue") { view = { screen: "menu", rowIndex: view.cursor, actionIndex: 0 }; refresh(); }`. `ui-issue-command-custom-list.test.ts`: `expect(menuEscape.renders.some((screen) => screen.includes("Open/Activate"))).toBe(true)`.  
**Verdict:** pass

### Criterion 14: The action menu for any issue includes `Open/Activate`, `Archive`, and `View`.
**Evidence:** `buildIssueActionItems` always pushes `open`, `archive`, `view` before the conditional close actions. `ui-issue-list-actions.test.ts`: `const nonActive = buildIssueActionItems(issue, null).map(i => i.label); expect(nonActive).toEqual(["Open/Activate", "Archive", "View", "Close"])`.  
**Verdict:** pass

### Criterion 15: The action menu for a non-active issue includes `Close`.
**Evidence:** `buildIssueActionItems`: when `issue.slug !== activeIssueSlug`, pushes `{ key: "close", label: "Close" }`. `ui-issue-list-actions.test.ts` confirms `nonActive` menu contains exactly `["Open/Activate", "Archive", "View", "Close"]`.  
**Verdict:** pass

### Criterion 16: The action menu for the active issue includes both `Close now` and `Go to done phase`.
**Evidence:** `buildIssueActionItems`: when `issue.slug === activeIssueSlug`, pushes `close-now` and `go-to-done` instead of `close`. `ui-issue-list-actions.test.ts`: `const active = buildIssueActionItems(issue, issue.slug).map(i => i.label); expect(active).toEqual(["Open/Activate", "Archive", "View", "Close now", "Go to done phase"])`.  
**Verdict:** pass

### Criterion 17: Choosing `Open/Activate` activates the selected issue using the same activation behavior.
**Evidence:** `ui.ts` lines 365–380: `open` action resets `completedTasks`, `currentTaskIndex`, `tddTaskState`, sets `activeIssue`, calls `store.updateIssueStatus(selected.slug, "in-progress")`. `ui-issue-command-open-action.test.ts` verifies full state reset and status update match the old flow.  
**Verdict:** pass

### Criterion 18: Choosing `Archive` archives the selected issue by reusing the project's existing archive behavior.
**Evidence:** `ui.ts` lines 382–399: `archive` action calls `store.archiveIssue(result.issue.slug)`, identical to the existing archive handler. If active issue is archived, state is reset.  
**Verdict:** pass

### Criterion 19: Choosing `View` replaces the list with an in-widget detail screen.
**Evidence:** In `handleInput` (menu screen): `if (selected.key === "view") { view = openIssueDetailView(row.issue, view.rowIndex); refresh(); return; }` — no `done()` call, stays in widget. `ui-issue-command-custom-list.test.ts`: `expect(detail.renders.some((screen) => screen.includes("Other issue full description"))).toBe(true)`.  
**Verdict:** pass

### Criterion 20: The detail screen shows the full issue contents available from the existing issue data.
**Evidence:** `renderIssueDetailScreen` renders id+title (bold), type+status+milestone line, full `issue.description` (split by `\n`). `ui-issue-list-detail.test.ts`: rendered contains `"Full detail view"`, `"First paragraph"`, `"Second paragraph with more detail."`.  
**Verdict:** pass

### Criterion 21: The detail screen provides a return action that restores the prior issue-list view.
**Evidence:** `handleInput` (detail screen): Escape or Backspace calls `view = returnToListView(view)` which returns `{ screen: "list", cursor: view.returnCursor }`. `ui-issue-list-detail.test.ts`: `expect(returnToListView(detail)).toEqual({ screen: "list", cursor: 4 })`. Integration test: `expect(detail.renders.some((screen) => screen.includes("Issue list"))).toBe(true)`.  
**Verdict:** pass

### Criterion 22: Choosing `Close` on a non-active issue closes that issue using existing issue-closing behavior.
**Evidence:** `ui.ts` lines 402–408: `close` action calls `store.updateIssueStatus(result.issue.slug, "done")` and notifies. Uses same `updateIssueStatus("done")` call as the existing close flow.  
**Verdict:** pass

### Criterion 23: Choosing `Close now` on the active issue performs the existing immediate-close behavior.
**Evidence:** `ui.ts` lines 410–421: `close-now` action calls `store.updateIssueStatus(result.issue.slug, "done")` and resets state to `createInitialState()` (same pattern as existing immediate-close).  
**Verdict:** pass

### Criterion 24: Choosing `Go to done phase` on the active issue performs the existing action for moving to done phase.
**Evidence:** `ui.ts` lines 423–438: `go-to-done` action calls `handleSignal(ctx.cwd, "phase_next", "done")` — same signal used by phase transitions.  
**Verdict:** pass

### Criterion 25: The implementation does not regress existing `/issue list` behavior for sorting, grouping, activation, archiving, or create-new flow.
**Evidence:** Old `ctx.ui.select()` fallback path remains intact (lines 451–480 in ui.ts). `ui-issue-command-list.test.ts` uses a mock ctx WITHOUT `custom` function, triggers the fallback select path, and verifies grouping still works: `expect(renderedItems).toContain("M1:"); expect(renderedItems).toContain("#002 [P1] M1 top [open]")`. Test passes: 1 pass, 0 fail.  
**Verdict:** pass

### Criterion 26: The issue-list row-building and navigation behavior is covered by deterministic pure tests.
**Evidence:** 
- `tests/ui-issue-list-rows.test.ts`: grouping, row ordering, non-focusable milestone headers, create row, status labels, active marker.
- `tests/ui-issue-list-navigation.test.ts`: arrow key navigation, Tab navigation, milestone skipping, cursor rendering.
Both files run pure functions with no file system or async dependencies. All 2 tests pass.  
**Verdict:** pass

### Criterion 27: Focused interaction tests cover keyboard navigation, Enter-to-open action menu, Escape-to-dismiss, action availability for active vs non-active issues, and the in-widget detail-view flow.
**Evidence:**
- `tests/ui-issue-command-custom-list.test.ts`: `driveWidget` drives the full `showIssueListUI` widget with synthetic key sequences. Tests: ESC dismisses → null, ENTER opens menu → "Open/Activate" visible, menu ESC returns to list, ENTER+DOWN+DOWN+ENTER opens View detail, BACKSPACE returns to list, ESC dismisses.
- `tests/ui-issue-list-actions.test.ts`: active vs non-active action availability.
All pass.  
**Verdict:** pass

---

## Overall Verdict

**pass**

All 27 acceptance criteria are satisfied. The full test suite passes (934 tests, 0 failures). The 6 new feature-specific tests all pass with 38 expect() calls covering:
- Pure row-building (grouping, milestone headers, status indicators, active marking, create row)
- Pure navigation logic (Up/Down/Tab, cursor skipping non-focusable rows)
- Action menu composition (non-active: Close; active: Close now + Go to done phase)
- Detail view state transitions (open, render, return)
- Full widget interaction via `showIssueListUI` (Escape-to-dismiss, Enter-to-menu, View-detail flow, Backspace-to-return)
- Open/Activate integration (state reset matching old flow)
- Non-regression: existing `ctx.ui.select()` fallback path remains and passes its test
