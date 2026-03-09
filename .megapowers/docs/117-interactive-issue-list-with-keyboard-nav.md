# Feature: Interactive `/issue list` Widget with Keyboard Navigation

**Issue:** #117  
**Type:** Feature  
**Shipped:** 2026-03-09

---

## What Was Built

Replaced the static `ctx.ui.select()` prompt used by `/issue list` with a fully keyboard-driven interactive widget built on `ctx.ui.custom()`. The widget preserves all existing issue-list behavior (milestone grouping, sorting, activation, archiving) while adding in-place navigation, per-issue action menus, and an inline detail view — all without leaving the widget.

---

## Why

The old `/issue list` experience rendered a flat list in a `select()` prompt. Users couldn't navigate between issues, view details, or take actions without completing the selection first. With many issues across milestones, this made the workflow slow. The new widget turns the issue list into a navigable, actionable surface.

---

## Architecture

### New module: `extensions/megapowers/ui-issue-list.ts`

All pure, testable logic extracted into a dedicated module:

| Export | Purpose |
|--------|---------|
| `buildIssueListRows(issues, activeIssueSlug, getBatchForIssue)` | Produces typed row array (milestone headers, issue rows, create row) from sorted issues |
| `moveIssueListCursor(rows, cursor, key)` | Pure cursor navigation — skips non-focusable milestone headers |
| `findFirstFocusableRow(rows)` | Finds the first focusable row index for initial focus |
| `renderIssueListScreen(rows, cursor, width, theme)` | Renders the list view as string lines |
| `buildIssueActionItems(issue, activeIssueSlug)` | Returns context-sensitive action menu items |
| `renderIssueActionMenuScreen(issue, items, actionIndex, width, theme)` | Renders the action menu as string lines |
| `openIssueDetailView(issue, returnCursor)` | Transitions to detail screen state |
| `returnToListView(view)` | Restores prior list cursor |
| `renderIssueDetailScreen(issue, width, theme)` | Renders the full issue detail as string lines |
| `showIssueListUI(ctx, rows, activeIssueSlug)` | Assembles the widget, manages screen state, dispatches input |

### Modified: `extensions/megapowers/ui.ts`

The `/issue list` handler now checks for `ctx.ui.custom` and, when available, routes through the new widget. The original `ctx.ui.select()` fallback path is preserved for environments without custom widget support.

Result dispatch after the widget closes:

| Result | Action |
|--------|--------|
| `null` (Escape) | No-op, return current state |
| `{ type: "create" }` | Delegates to existing `handleIssueCommand(ctx, state, store, "new")` |
| `open` | Activates issue with full state reset (same as old select path) |
| `archive` | Calls `store.archiveIssue()`; resets state if active issue archived |
| `close` | Marks non-active issue as `done` |
| `close-now` | Marks active issue as `done`, resets state |
| `go-to-done` | Calls `handleSignal("phase_next", "done")` |

### Widget screens

```
list view
  ↓ Enter on issue row
action menu  ←── Esc ──── back
  ↓ Enter on "View"
detail view  ←── Esc / Backspace ── back
```

---

## User-Facing Behavior

- **`↑` / `↓`**: Move between issues and the create row; milestone headers are skipped.
- **`Tab`**: Move forward (same as `↓`).
- **`Enter`** on issue: open action menu for that issue.
- **`Enter`** on `+ Create new issue...`: start the existing issue-creation flow.
- **`Esc`**: dismiss without side effects (from list) or go back (from menu/detail).
- **`Backspace`**: return from detail view to list.

### Action menu items

| Issue type | Available actions |
|------------|------------------|
| Any issue | Open/Activate, Archive, View |
| Non-active | + Close |
| Active | + Close now, Go to done phase |

### Row labels

Each issue row shows: `#NNN [PX] Title [status] (in batch slug)? ● active?`

---

## Test Coverage

10 new test files across two layers:

**Pure unit tests** (no I/O):
- `tests/ui-issue-list-rows.test.ts` — grouping, milestone headers, status indicators, active marker, create row
- `tests/ui-issue-list-navigation.test.ts` — Up/Down/Tab navigation, milestone skipping, cursor rendering
- `tests/ui-issue-list-actions.test.ts` — action menu composition for active vs non-active issues
- `tests/ui-issue-list-detail.test.ts` — detail view open/render/return

**Integration tests** (real store + state):
- `tests/ui-issue-command-custom-list.test.ts` — full widget drive: ESC, Enter→menu, View→detail, Backspace→list
- `tests/ui-issue-command-open-action.test.ts` — Open/Activate state reset matches old flow
- `tests/ui-issue-command-archive-action.test.ts` — Archive (non-active + active → state reset)
- `tests/ui-issue-command-close-actions.test.ts` — Close, Close now, Go to done phase
- `tests/ui-issue-command-create-row.test.ts` — create row invokes existing new-issue flow

---

## Non-Regression

The original `ctx.ui.select()` path is kept intact as a fallback. `tests/ui-issue-command-list.test.ts` (existing test, no `custom` in mock) continues to pass, confirming the fallback path works.

Final test count after this feature: **935 pass, 0 fail**.
