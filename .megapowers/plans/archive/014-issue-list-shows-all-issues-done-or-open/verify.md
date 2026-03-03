That's the dashboard renderer — it uses `listIssues()` unfiltered, which is correct (the dashboard might show a count or overview of all issues). The fix only applies to the **list/selection** path. No collateral damage.

---

## Verification Report

## Test Suite Results
```
330 pass
0 fail
593 expect() calls
Ran 330 tests across 15 files. [92.00ms]
```

## Per-Criterion Verification

### Criterion 1: Done issues are filtered from `/issue list`
**Evidence:** `extensions/megapowers/ui.ts` line 212: `store.listIssues().filter(i => i.status !== "done")`. Test `"issue list filters out done issues"` creates 3 issues (1 open, 2 done), asserts only 1 appears in the select menu. **Passes.**
**Verdict:** ✅ pass

### Criterion 2: Empty-state message when all issues are done
**Evidence:** `extensions/megapowers/ui.ts` line 214: `"No open issues. Use /issue new to create one."`. Test `"shows 'no issues' message when all issues are done"` creates 1 done issue, asserts notification fires with "no" + "issues" text. **Passes.**
**Verdict:** ✅ pass

### Criterion 3: In-progress issues still appear in the list
**Evidence:** Test `"shows in-progress issues in the list"` creates 1 in-progress issue, asserts it appears. **Passes.**
**Verdict:** ✅ pass

### Criterion 4: No collateral damage to other `listIssues()` callers
**Evidence:** `grep -rn "listIssues"` shows two callers — line 150 (dashboard, unfiltered, correct) and line 212 (list/select, now filtered). `store.listIssues()` itself unchanged.
**Verdict:** ✅ pass

## Overall Verdict
**✅ pass** — The fix is minimal (one `.filter()` call, one message change), all 330 tests pass, the three targeted tests confirm the behavior, and no other code paths are affected.