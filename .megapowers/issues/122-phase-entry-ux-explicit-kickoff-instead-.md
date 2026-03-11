---
id: 122
type: feature
status: open
created: 2026-03-11T15:40:48.597Z
sources: [51]
milestone: M1
priority: 1
---
# Phase entry UX — explicit kickoff instead of dummy first messages
Split from #051. Megapowers phase transitions currently update workflow state and inject context, but they do not create an intentional phase-start interaction. In practice, after entering a phase, the user often has to type a meaningless message like `a` or `go` just to trigger the first agent turn.

## Problem

Current flow:
1. issue activates or phase changes
2. dashboard/status updates
3. hidden context is injected
4. user must send an arbitrary message to actually begin the phase

This is especially awkward because megapowers already knows enough to guide entry:
- current phase
- workflow type
- expected artifact/output
- current task in implement
- plan mode in plan (`draft`, `review`, `revise`)

## Desired behavior

Entering a phase should present a clear phase-entry interaction with intentional next actions instead of requiring a dummy message.

Examples:
- artifact phases: **Start phase**, **View context**, **Discuss**, **Dismiss**
- plan: mode-aware **Start draft**, **Start review**, **Start revision**
- implement: task-aware **Start task**, **View task context**, **Discuss task**
- done: **Open wrap-up checklist** / **Continue wrap-up**

Selecting **Start** should visibly kick off the phase without requiring arbitrary bootstrap input.

## Scope

- phase-entry affordance on issue activation and phase transitions
- phase-aware kickoff behavior for all workflows
- mode-aware kickoff for `plan`
- task-aware kickoff for `implement`
- safe non-mutating “Discuss” path
- visible kickoff message instead of requiring meaningless user text

## Non-goals

- telemetry
- append-only audit log
- workflow redesign
- changing TDD semantics

## Acceptance criteria

- entering a phase presents an explicit next action
- user no longer needs to send a meaningless first message to begin work
- `plan` entry is aware of plan mode
- `implement` entry is aware of current task + TDD state
- Discuss stays in the same phase and does not mutate workflow state
- done-phase checklist behavior remains intact
