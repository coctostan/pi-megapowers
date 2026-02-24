---
id: 25
type: feature
status: done
created: 2026-02-23T15:30:00.000Z
---

# Package subagent implementation within megapowers

## Problem

During the implement phase, the prompt suggests delegating independent tasks to subagents, but the `subagent` tool isn't available because it isn't installed/registered. The satellite detection code (`satellite.ts`) exists for handling subagent sessions, but there's no code to register the subagent tool itself.

## Context

Pi's subagent capability requires either:
1. A built-in `subagent` tool from the pi harness (not currently present)
2. A custom tool registered by the extension via `pi.registerTool()`

Currently megapowers has `satellite.ts` which detects if the current session IS a subagent, but nothing to spawn subagents from the parent session.

## Desired Behavior

Megapowers should register a `subagent` tool that:
1. Spawns a new pi session with a task description
2. Passes the current working directory and megapowers state context
3. Enables satellite mode in the child session (TDD guard only)
4. Returns the subagent's result when complete

This is a **feature** — the subagent infrastructure needs to be built, not just fixed.
