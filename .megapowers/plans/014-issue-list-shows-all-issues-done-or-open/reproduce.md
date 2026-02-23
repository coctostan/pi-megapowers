All three tests behave as expected:

1. **`issue list filters out done issues`** — **FAILS** ✅ (expected 1 item, got 3 — confirms the bug: all issues shown including done ones)
2. **`shows 'no issues' message when all issues are done`** — **FAILS** ✅ (shows the select menu instead of "no issues" notification when only done issues exist)
3. **`shows in-progress issues in the list`** — **PASSES** ✅ (in-progress issues should be shown, and they are)

---

# Bug Report: Issue list shows all issues (done and open) with no filtering

## Steps to Reproduce
1. Create several issues using `/issue new`
2. Complete some issues through the full workflow until they reach "done" status  
3. Run `/issue list` to see available issues

## Expected Behavior
The issue list should only show open/in-progress issues. Done issues are not actionable and clutter the selection menu.

## Actual Behavior
`/issue list` displays ALL issues regardless of status. The code in `ui.ts` → `handleIssueCommand` → `list` subcommand calls `store.listIssues()` and passes all results directly to `ctx.ui.select()` with no filtering:

```typescript
const issues = store.listIssues();  // returns ALL issues — no status filter
const items = issues.map(formatIssueListItem);
```

Currently 14 issues exist (7 done, 6 open, 1 in-progress), and all 14 are shown in the selection menu.

## Environment
- Runtime: Bun 1.3.9
- Project: pi-megapowers extension
- File: `extensions/megapowers/ui.ts`, lines ~192-200

## Failing Test
Added 3 tests in `tests/ui.test.ts` under `describe("handleIssueCommand — list filtering")`:

| Test | Status | What it proves |
|---|---|---|
| `issue list filters out done issues` | FAILS (expected 1, got 3) | Done issues appear in the list |
| `shows 'no issues' message when all issues are done` | FAILS | No "no issues" notification when only done issues exist |
| `shows in-progress issues in the list` | PASSES | In-progress issues correctly appear (baseline) |