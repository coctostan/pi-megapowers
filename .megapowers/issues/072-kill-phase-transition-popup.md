---
id: 72
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M1
priority: 1
---

# Kill Phase Transition Popup

## Problem

When a phase completes (agent_end hook), a select widget pops up asking the user to choose the next phase. This interrupts flow, is confusing for new users ("why is it asking me this?"), and blocks the agent from continuing. The PRD identifies this as the #1 UX pain point.

The popup also doesn't handle backward transitions — it only offers forward options.

## Proposed Solution

Replace the popup with:
1. **Auto-advance** — when phase gates are met, transition automatically and show a notification ("Moving to plan phase")
2. **Notification bar** — persistent phase indicator showing current phase and progress
3. **Manual override** — `/mp phase <name>` for when the user wants to jump (forward or backward)

The agent_end hook becomes: check gates → if met, auto-transition + notify. If not met, show what's missing ("Spec has 2 open questions — resolve before advancing").

## Acceptance Criteria

- [ ] agent_end no longer shows select widget for phase transitions
- [ ] Auto-advance triggers when phase gate conditions are met
- [ ] Notification shown on phase transition (not a blocking dialog)
- [ ] Missing-gate feedback shown when auto-advance can't proceed
- [ ] `/mp phase <name>` still works for manual override
- [ ] No regression in phase enforcement (gates still enforced)

## Notes

- Closely related to #042 (interactive UX transparency) and #051 (UX feedback). Could be worked together.
- The select widget may still be appropriate for other things (issue selection, etc.) — just not phase transitions.
