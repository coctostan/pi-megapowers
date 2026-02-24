---
id: 48
type: bugfix
status: open
created: 2026-02-24T19:00:00.000Z
---

# LLM has no megapowers context when no issue is active

## Problem

When the LLM is not in an active megapowers workflow (no active issue selected), `buildInjectedPrompt()` returns `null` and the agent receives zero megapowers context. It doesn't know what megapowers is, what tools are available (`megapowers_signal`, `megapowers_save_artifact`, `create_batch`, `subagent`, etc.), or how to start a workflow. The agent can't help the user create issues, select issues, or interact with megapowers at all.

## Reproduction

1. Start a pi session with megapowers enabled but no active issue
2. Ask the agent about megapowers or to create an issue
3. Agent has no idea what megapowers is — the system prompt contains nothing about it

## Root Cause

`extensions/megapowers/prompt-inject.ts` line:
```ts
if (!state.activeIssue || !state.phase) return null;
```

This early-return skips ALL prompt injection, including the base protocol (`megapowers-protocol.md`) which describes the tools and workflow. The phase-specific templates correctly need an active issue, but the base protocol and tool descriptions should always be injected when mega is enabled.

## Expected Behavior

When megapowers is enabled (`state.megaEnabled === true`) but no issue is active, the LLM should still receive:
- The base megapowers protocol (what it is, available tools, how to start)
- Awareness of `/issue` command for selecting/creating issues
- Knowledge of `create_issue` and `create_batch` tools (once #046 ships)
- Guidance on how to begin a workflow

Phase-specific templates (brainstorm instructions, implement TDD rules, etc.) should still require an active issue — that's correct.

## Related

- #046 — `create_issue` tool (the agent needs to know about it even outside a workflow)
