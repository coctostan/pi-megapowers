---
id: 36
type: feature
status: open
created: 2026-02-23T23:30:00.000Z
---

# Question interactions: multi-select for done-phase menu + "Discuss" option

Two related problems with interactive menus in `ui.ts`:

## 1. Done-phase menu should be multi-select, not single-select-then-loop

`handleDonePhase()` presents a list of wrap-up actions (Generate docs, Write changelog, Capture learnings, Close issue, etc.) via `ctx.ui.select()` — a single-select prompt. The code works around this with a `while (continueMenu)` loop that re-presents the menu after each action, but this is clunky: the user has to re-navigate the list for each item they want. The natural UX for "pick everything you want to do" is a multi-select checkbox list. The pi SDK likely has `ctx.ui.multiSelect()` or equivalent.

**Expected:** User opens the done-phase menu, ticks "Generate docs", "Write changelog", "Capture learnings", confirms, and the agent runs all three. No re-looping.

## 2. Missing "Discuss" option on phase menus

`handlePhaseTransition()` only offers forward/backward phase transitions. There is no way for the user to say "I want to talk to the LLM about the current state without triggering any transition". The user is forced to either trigger a transition or dismiss the menu and send a free-form message — but the menu intercepts the natural interaction point.

**Expected:** Every phase selection menu has a "Discuss..." option (or equivalent) that simply opens a conversation with the LLM in the current context, with the injected phase prompt visible, without mutating state.

## Affected files
- `extensions/megapowers/ui.ts` — `handleDonePhase()` (done-phase loop), `handlePhaseTransition()` (phase menu)
