---
id: 121
type: feature
status: open
created: 2026-03-10T00:00:00.000Z
priority: 2
milestone: M1
---
# Megapowers operation feedback — progress, result summaries, and next-step clarity
Split from #051. Megapowers-owned commands and tools often work correctly, but the user-facing feedback is inconsistent and sometimes too terse.

## Problem

Examples:
- stateful tool calls can feel invisible while running
- some transitions do not clearly explain what changed
- artifact-related actions do not always tell the user where outputs live
- next steps are sometimes implied instead of stated

## Desired behavior

Megapowers actions should consistently communicate:
- started
- completed
- failed
- what changed
- what to do next

Applies to:
- `megapowers_signal`
- `megapowers_plan_task`
- `megapowers_plan_review`
- relevant slash commands like `/issue`, `/phase`, `/mega on|off`

## Scope

- consistent start/progress feedback
- consistent success/error wording
- clearer result summaries
- artifact path inclusion when megapowers created/updated outputs
- explicit next-step hints after major actions

## Non-goals

- full telemetry
- major TUI redesign
- rewriting already-good tool messages without need

## Acceptance criteria

- megapowers actions provide visible progress or start feedback
- success/error messaging is consistent
- result messages explain what changed
- next-step guidance is explicit after major transitions