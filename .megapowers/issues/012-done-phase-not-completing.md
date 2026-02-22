---
id: 12
type: bugfix
status: open
created: 2026-02-22T17:05:00.000Z
---

# Done phase doesn't complete — keeps prompting, status never turns yellow

When reaching the done phase, the extension repeatedly asks the user to finish the workflow. Clicking "Done" in the menu doesn't actually finalize anything — the phase status indicator never turns yellow (completed), and the menu keeps reappearing on the next turn.

Likely causes:
- The "Done — finish without further actions" menu option may not be setting `state.phase` or `issue.status` to a terminal value
- The done-phase loop's exit condition may not be persisting to the state file
- The dashboard/UI may not recognize the completed state for rendering the yellow indicator
- `session_shutdown` may be overwriting the completed state with the pre-done in-memory state (related to issue 004)
