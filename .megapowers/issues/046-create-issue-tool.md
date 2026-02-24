---
id: 46
type: feature
status: open
created: 2026-02-24T18:48:00.000Z
---

# Register a `create_issue` tool for the LLM agent

## Problem

The LLM has no way to create a new issue during a session. `store.createIssue()` exists and `create_batch` is registered as a tool, but there's no corresponding `create_issue` tool. When the agent encounters a bug or wants to track follow-up work, it has no mechanism to do so — it either tries to edit issue files directly (blocked by write policy) or asks the user to create one manually.

## Context

- `store.createIssue(title, type, description, sources?)` already handles ID assignment, slug generation, and file writing
- `create_batch` is the only issue-management tool currently registered
- The agent sometimes discovers bugs or scope items mid-session that should be tracked but aren't part of the current workflow

## Desired Behavior

Register a `create_issue` tool via `pi.registerTool()` that accepts:
- `title` (string, required)
- `type` ("feature" | "bugfix", required)  
- `description` (string, required)

Returns the created issue's slug and ID, same pattern as `create_batch`. The tool should be available in all phases (issue tracking isn't phase-gated). Should respect mega off/on toggle like other tools.
