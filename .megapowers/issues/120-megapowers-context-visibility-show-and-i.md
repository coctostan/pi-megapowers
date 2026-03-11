---
id: 120
type: feature
status: open
created: 2026-03-10T00:00:00.000Z
priority: 2
milestone: M1
---
# Megapowers context visibility — show and inspect injected context
Split from #051. Megapowers injects substantial phase/task/tool context before agent turns, but that context is currently invisible to the user because the injected message is hidden.

## Problem

`before_agent_start` injects a `megapowers-context` message with `display: false`, so users cannot tell:
- whether context injection happened
- which phase/task/mode was injected
- which artifacts were included
- why the LLM is behaving the way it is

This makes the system feel opaque and makes debugging difficult.

## Desired behavior

Provide lightweight visibility into current derived context without overwhelming normal usage.

Two layers:
1. **Compact summary** — e.g. `⚡ context ready: implement • task 2/5 • 3 artifacts`
2. **Inspect/debug command** — e.g. `/mega context` or `/mp context`

The inspect/debug surface should show:
- current workflow + phase
- plan mode if applicable
- current task + TDD state if applicable
- included artifacts
- optional rendered prompt/debug details

## Scope

- compact context indicator in widget/status/notification
- command to inspect current context on demand
- on-demand derivation from state + artifact files

## Non-goals

- storing full prompt text in `state.json`
- exposing every hidden system message by default

## Acceptance criteria

- users can tell when context injection occurred
- users can inspect current context via command
- summary includes more than just phase name
- no derived prompt/context is persisted into coordination state