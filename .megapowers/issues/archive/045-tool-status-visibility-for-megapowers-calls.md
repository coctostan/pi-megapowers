---
id: 45
type: bugfix
status: done
created: 2026-02-24T16:00:06.000Z
---

# Megapowers tool calls lack visible status/progress feedback (appears frozen)

Megapowers tool calls like `megapowers_save_artifact` and `megapowers_signal` currently feel like a black box to the user.

## Problem

- When these tools run, there is little or no immediate user-facing indication that work is in progress.
- Users cannot tell whether the operation is:
  - running,
  - completed,
  - failed,
  - or stalled/frozen.

This is especially confusing for actions that mutate workflow state (phase transitions, task completion) or write artifacts.

## Desired behavior

For megapowers tool actions (at minimum `megapowers_save_artifact` and `megapowers_signal`):

1. Show immediate visible feedback that the action started.
2. Show clear completion feedback with what happened (e.g. exact artifact path saved, phase transition result).
3. Show clear failure feedback with actionable error text.
4. Keep dashboard/status indicators in sync after successful state changes.

## Likely affected areas

- `extensions/megapowers/index.ts` (tool handlers and UI notification points)
- `extensions/megapowers/ui.ts` (status rendering helpers)
- `extensions/megapowers/tool-signal.ts` / `tool-artifact.ts` (message content surfaced to UI)
- tests for integration/UI notification behavior (`tests/index-integration.test.ts`, `tests/ui.test.ts`)
