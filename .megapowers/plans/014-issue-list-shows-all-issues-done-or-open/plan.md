# Plan: Filter done issues from `/issue list`

### Task 1: Filter out done issues in the list subcommand

**Files:** Modify `extensions/megapowers/ui.ts` (~line 212)

**What to change:** Two surgical edits in the `list` branch of `handleIssueCommand`:

1. Add `.filter(i => i.status !== "done")` after `store.listIssues()` 
2. Change the empty-state message from `"No issues."` to `"No open issues."` so the user knows completed issues exist

**Tests:** Already written in the reproduce phase — 3 tests in `tests/ui.test.ts` under `describe("handleIssueCommand — list filtering")`.

**Verify:** `bun test tests/ui.test.ts --grep "list filter"` — all 3 pass.

That's it — one task. Ready for `/phase` → review.