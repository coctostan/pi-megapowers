---
name: draft-assist
description: Run plan-scout then planner for bounded draft assistance
---

## plan-scout
output: context.md

Read the active planning artifact for `{task}` and produce a bounded planning handoff in `context.md`.
Stay advisory only and do not create canonical plan task state.

## planner
reads: context.md
model: anthropic/claude-sonnet-4-5:high
progress: true

Read `context.md` and produce an advisory planning draft for `{task}`.
Use the scout output to suggest task slices, ordering, and coverage notes.
Do not create canonical plan task files.
Do not call `megapowers_plan_task`.
Do not call `megapowers_plan_review`.
Do not call `megapowers_signal`.
The main planning session remains responsible for actual task creation, review submission, and workflow transitions.
