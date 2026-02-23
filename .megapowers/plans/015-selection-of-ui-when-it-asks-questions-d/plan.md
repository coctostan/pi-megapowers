# Plan: Show doneMode in dashboard and status bar

### Task 1: Add doneMode label map and show doneMode in `renderDashboardLines`

**Modify:** `extensions/megapowers/ui.ts`  
**Tests:** 2 existing tests in `tests/ui.test.ts` — dashboard contains `"changelog"` and `"send"` when doneMode is set  
**What:** Add a `DONE_MODE_LABELS` map (doneMode → human label), then add 2 lines to `renderDashboardLines` before the jj block:
- `Action: Write changelog` (the active mode)
- `Send any message to generate.` (what to do next)

### Task 2: Show doneMode in `renderStatusText`

**Modify:** `extensions/megapowers/ui.ts`  
**Tests:** 1 existing test — status text contains `"changelog"` when doneMode is set  
**Depends on:** Task 1 (reuses `DONE_MODE_LABELS`)  
**What:** Append ` → Write changelog` to the status text when doneMode is active, changing `📋 #014 done` to `📋 #014 done → Write changelog`