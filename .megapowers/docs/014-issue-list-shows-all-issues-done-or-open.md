

# Bugfix: Issue list shows all issues (done and open) with no filtering

## Bug Description
The `/issue list` command displayed every issue regardless of status — done, open, and in-progress alike. Users had to visually scan past completed issues to find actionable work. When all issues were done, the list still showed them instead of notifying the user there was nothing to work on.

## Root Cause
In `extensions/megapowers/ui.ts`, the `handleIssueCommand` method's `list` branch called `store.listIssues()` and passed the unfiltered result directly to `ctx.ui.select()`. The store method correctly returns all issues — the bug was that the UI consumer applied no status filter before presenting the selection menu.

## Fix Applied
Added `.filter(i => i.status !== "done")` after `store.listIssues()` in the `list` subcommand. Changed the empty-state notification from "No issues" to "No open issues" so the message is accurate when completed issues exist but none are actionable. The filter lives in the UI layer only — `store.listIssues()` is unchanged, and the dashboard renderer (the other caller) still sees all issues.

## Regression Tests
Three tests added in `tests/ui.test.ts` under `describe("handleIssueCommand — list filtering")`:

| Test | What it verifies |
|---|---|
| `issue list filters out done issues` | Creates 3 issues (1 open, 2 done), asserts only the open one appears in the select menu |
| `shows 'no issues' message when all issues are done` | Creates 1 done issue, asserts "no open issues" notification fires instead of select menu |
| `shows in-progress issues in the list` | Creates 1 in-progress issue, asserts it appears in the list |

## Files Changed
- `extensions/megapowers/ui.ts` — Added `.filter(i => i.status !== "done")` on the list query and updated empty-state message
- `tests/ui.test.ts` — Added 3 regression tests for issue list filtering behavior