---
id: 117
type: feature
status: in-progress
created: 2026-03-09T01:10:41.618Z
milestone: M1
priority: 1
---
# Interactive issue list with keyboard navigation and per-issue actions
Replace the simple `ctx.ui.select()` dropdown in `/issue list` with a full interactive widget (using `ctx.ui.custom()`, like `ui-checklist.ts`) that supports:

- **Arrow key / Tab navigation** through issues (grouped by milestone)
- **Per-issue action menu** — press Enter on an issue to get contextual actions:
  - **Open/Activate** — switch to this issue (current behavior)
  - **Close** — mark as done
  - **Archive** — move to archive
  - **View** — show issue details inline
- **Visual indicators** — cursor highlight, status badges (open/in-progress/done), active issue marker
- **Escape** to dismiss without action
- **"+ Create new issue..."** row preserved at the bottom

Currently `/issue list` is a dumb `ctx.ui.select()` picker — you pick an issue and it activates it, period. No way to close, archive, or even see details without leaving the list. The checklist widget in `ui-checklist.ts` already demonstrates the `ctx.ui.custom()` pattern with full keyboard handling — this should follow the same approach.

Files involved:
- `extensions/megapowers/ui.ts` — `handleIssueCommand` list subcommand (replace `ctx.ui.select` with custom widget)
- New: `extensions/megapowers/ui-issue-list.ts` — extracted interactive issue list widget
- `extensions/megapowers/ui-checklist.ts` — reference pattern for `ctx.ui.custom()` keyboard widget
- `tests/ui-issue-list.test.ts` / new test file for the widget
