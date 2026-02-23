All 3 new tests fail for the right reason:

1. **Dashboard** — `renderDashboardLines` output is `"Issue: #014-filter-issues [bugfix]\nPhase: ... ▶done"` — **no mention of `doneMode`**
2. **Dashboard instruction** — no "send" instruction anywhere in the output  
3. **Status bar** — `renderStatusText` returns `"📋 #014 done"` — **no mention of `doneMode`**

The existing `handleDonePhase` tests pass (doneMode IS set in state), confirming the bug is purely in the **rendering layer** — `doneMode` is invisible to the user.

---

# Bug Report: No persistent feedback after selecting a done-phase action

## Steps to Reproduce
1. Complete a workflow through to the done phase
2. Done-phase wrap-up menu appears with ~5 choices
3. Select any action (e.g., "Write changelog entry")
4. Observe the UI

## Expected Behavior
After selecting a done-phase action, the dashboard and/or status bar should show:
- What mode is active (e.g., "changelog")
- What the user needs to do next ("send a message to generate")

## Actual Behavior
- A transient `ctx.ui.notify()` fires but the user **did not see it**
- The dashboard re-renders but shows only `Phase: ... ▶done` — **`doneMode` has zero representation** in `renderDashboardLines` or `renderStatusText`
- The user sees a blank input prompt with no idea what was selected or what to do next
- The underlying mechanism works — when the user eventually sends a message, the prompt IS injected and the LLM generates correct output

## Environment
- Runtime: Bun 1.3.9
- Files: `extensions/megapowers/ui.ts` — `renderDashboardLines()` (line 49), `renderStatusText()` (line 40)

## Failing Tests
3 tests in `tests/ui.test.ts`:

| Test | What it checks |
|---|---|
| `renderDashboardLines — done phase with doneMode > shows active doneMode` | Dashboard output contains "changelog" when doneMode is "write-changelog" |
| `renderDashboardLines — done phase with doneMode > shows instruction to send` | Dashboard contains "send" instruction when doneMode is active |
| `renderStatusText — done phase with doneMode > includes doneMode in status` | Status bar contains "changelog" when doneMode is "write-changelog" |

All 3 fail — `doneMode` is completely absent from UI rendering.