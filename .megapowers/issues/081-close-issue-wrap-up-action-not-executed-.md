---
id: 81
type: bugfix
status: open
created: 2026-03-03T13:28:41.826Z
---
# close-issue wrap-up action not executed in prompt-driven done phase
## Problem

When the done phase runs via the LLM prompt (wrap-up actions injected into the session), `close-issue` is listed as a selected action but **never actually executes** — the agent just narrates "the issue is ready to close."

The automation in `onAgentEnd` (`hooks.ts:105-119`) works correctly **only when `state.doneActions` is pre-populated** (i.e., the user selects actions via the TUI menu, which writes them to state before the agent session starts). In the prompt-driven path there is no code that populates `state.doneActions`, so `onAgentEnd` skips the close logic entirely.

## Root Cause

Two separate code paths for the done phase:
1. **TUI menu path**: `handleDonePhase` renders a checklist, user picks actions → written to `state.doneActions` → `onAgentEnd` fires and processes them.
2. **Prompt-driven path**: wrap-up action instructions are injected into the LLM context → agent narrates the actions → `state.doneActions` never populated → `onAgentEnd` no-ops.

`close-issue` requires `store.updateIssueStatus(slug, "done")` + `writeState` reset. Neither happens in the prompt-driven path.

## Fix Approach

Either:
- **Option A**: Make the `close-issue` action in the prompt-driven path explicitly call `store.updateIssueStatus` and reset state (same logic as `onAgentEnd` lines 105-119), triggered by a tool or hook rather than relying on `state.doneActions`.
- **Option B**: Populate `state.doneActions` before the LLM session starts in the prompt-driven done path, so `onAgentEnd` handles it uniformly.

Option B is simpler and keeps the logic in one place.

## Impact

Every completed issue in the prompt-driven workflow is left in `status: open` and `state.activeIssue` is not cleared, requiring manual intervention to pick up the next issue cleanly.
