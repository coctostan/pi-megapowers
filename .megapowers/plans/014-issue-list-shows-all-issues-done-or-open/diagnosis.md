# Diagnosis

## Root Cause

The bug is in `extensions/megapowers/ui.ts`, `handleIssueCommand` → `list` branch (line ~215). It calls `store.listIssues()` which returns **all** issues from disk, and passes the unfiltered result straight to `ctx.ui.select()`:

```typescript
const issues = store.listIssues();  // returns ALL issues — no status filter
const items = issues.map(formatIssueListItem);
```

`store.listIssues()` is correct — it returns all issues. The bug is that the **UI consumer doesn't filter out done issues** before presenting the selection menu.

## Affected Code

| File | Function | Role |
|---|---|---|
| `extensions/megapowers/ui.ts` | `handleIssueCommand`, `list` branch (~line 215) | **Primary fix site** — needs `.filter()` before presenting |
| `extensions/megapowers/store.ts` | `listIssues()` (line 139) | Returns all issues; no change needed |

## Risk Assessment

**Low risk.** A single `.filter(i => i.status !== "done")` in the UI layer. Two things to watch:
1. The "no issues" empty-state check must run **after** filtering, so when all issues are done the user gets a "No open issues" message instead of a broken empty select menu.
2. No other callers of `listIssues()` are affected since the filter lives in the UI layer.

Ready for `/phase` → plan.