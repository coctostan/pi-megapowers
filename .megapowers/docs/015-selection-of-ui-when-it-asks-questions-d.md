

# Bugfix: No persistent feedback after selecting a done-phase action

## Bug Description
After selecting an action from the done-phase wrap-up menu (e.g., "Write changelog entry"), the user saw a blank input prompt with no indication of what was selected or what to do next. The only feedback was a transient `ctx.ui.notify()` call that the user missed. The underlying mechanism worked correctly — prompt injection fired when the user eventually sent a message — but the UI gave zero persistent indication of the active mode.

## Root Cause
`renderDashboardLines()` and `renderStatusText()` in `ui.ts` had no code path that read `state.doneMode`. When `handleDonePhase` set `doneMode` (e.g., `"write-changelog"`), the dashboard immediately re-rendered but displayed only `Phase: ... ▶done` with no mention of the active action. The transient notification was the sole feedback channel, and it was too easy to miss.

## Fix Applied
Added a `DONE_MODE_LABELS` map translating doneMode values to human-friendly labels (e.g., `"write-changelog"` → `"Write changelog"`). Then:

1. **Dashboard** (`renderDashboardLines`): When `state.phase === "done" && state.doneMode`, two lines are appended — `Action: Write changelog` and `Send any message to generate.`
2. **Status bar** (`renderStatusText`): The doneMode label is appended, changing `📋 #014 done` to `📋 #014 done → Write changelog`.

This ensures the user always has persistent, visible context about the active done-phase action without relying on transient notifications.

## Regression Tests
Three tests added in `tests/ui.test.ts`:

| Test | What it verifies |
|---|---|
| `renderDashboardLines — done phase with doneMode > shows active doneMode in dashboard when set` | Dashboard output contains the mode label |
| `renderDashboardLines — done phase with doneMode > shows instruction to send a message` | Dashboard contains "send" instruction |
| `renderStatusText — done phase with doneMode > includes doneMode in status text` | Status bar contains the mode label |

## Files Changed
- `extensions/megapowers/ui.ts` — Added `DONE_MODE_LABELS` map, doneMode rendering in `renderDashboardLines` and `renderStatusText`
- `tests/ui.test.ts` — Added 3 regression tests for doneMode visibility in dashboard and status bar