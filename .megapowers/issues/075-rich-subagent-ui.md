---
id: 75
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M2
priority: 3
---

# Rich Subagent UI

## Problem

When a subagent is running, the user sees almost nothing — just that something was delegated and eventually a status check. No visibility into: which agent, what model, what task, how long it's been running, how many tool calls, what it's doing right now, estimated cost.

## Proposed Solution

Subagent display panel showing:
- Agent name + model
- Task description
- Current status (running / waiting / done / failed)
- Duration + token count + estimated cost
- Tool calls (count, last N tool names)
- Files changed so far (from jj status in workspace)

Implementation via pi's TUI notification/widget system. Updates on each `subagent_status` poll.

## Acceptance Criteria

- [ ] Subagent panel shows agent name, model, task when delegation starts
- [ ] Live status updates (running/done/failed)
- [ ] Duration and token count displayed
- [ ] Tool call count visible
- [ ] Files changed visible on completion
- [ ] Panel clears or collapses when subagent completes

## Notes

- Depends on #074 (structured handoff) for result data.
- Nice-to-have: streaming subagent output. But that requires pi SDK support for cross-workspace streaming, which doesn't exist yet.
