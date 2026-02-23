# Diagnosis

## Root Cause

`renderDashboardLines()` and `renderStatusText()` in `ui.ts` have **no code path that reads `state.doneMode`**. When the user selects a done-phase action, `handleDonePhase` correctly sets `doneMode` in state and fires a transient `ctx.ui.notify()`. But the dashboard immediately re-renders (index.ts:463) and neither rendering function includes the active mode — so the notification was the only feedback, and you missed it.

- `renderStatusText()` → `📋 #014 done` — no doneMode
- `renderDashboardLines()` → `Phase: ... ▶done` — no doneMode, no instruction

The `doneMode` field is correctly set in state and used by prompt injection. The gap is purely in the **rendering layer** — two pure functions that need a conditional block added.

## Affected Code

| File | Function | What's missing |
|---|---|---|
| `extensions/megapowers/ui.ts` | `renderStatusText()` (line 40) | No doneMode in status output |
| `extensions/megapowers/ui.ts` | `renderDashboardLines()` (line 49) | No doneMode line, no "send a message" instruction |

## Risk Assessment

**Very low risk.** Both functions are pure (state → strings). Adding a `state.phase === "done" && state.doneMode` block won't affect any other phase. Existing tests don't set `doneMode`.