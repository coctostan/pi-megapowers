# Brainstorm: Triage LLM-Driven Batching

## Problem
`/triage` currently uses an interactive UI wizard (input/select/editor prompts) to ask the user how to batch issues. The user has to manually decide groupings — defeating the purpose of having an LLM.

## Approach

Refactor `/triage` from an interactive UI wizard into an LLM-driven flow. The command becomes a thin trigger: it gathers open issues from the store, interpolates them into `prompts/triage.md`, and injects the result via `pi.appendEntry` so the LLM has full context. The LLM then proposes batch groupings conversationally. The user can discuss, adjust, and when satisfied, tells the LLM to create them.

Batch creation happens through a `create_batch` tool registered via `pi.registerTool()`. The LLM calls it once per batch with title, type, source IDs, and description. The tool handler delegates to `store.createIssue()` with sources. No parsing of LLM prose, no triage mode flag, no state machine changes. The tool is always available — it's just "create a batch issue," a valid operation regardless of context.

## Key Decisions

- **Tool, not parsed output** — `create_batch` tool avoids fragile regex parsing of LLM responses
- **No triageMode state** — triage is a tool + prompt injection, not a workflow phase
- **Minimal tool description** — short description, just the params needed, no bloat in context
- **Scoped to triage only** — broader workflow-as-tools (#027) is a separate issue
- **Multi-turn flow** — LLM proposes, user discusses/adjusts, then explicit "create them" triggers tool calls
- **`/triage` command stays** — it's still the entry point, just injects prompt instead of launching a wizard

## Components

- **`create_batch` tool** — registered in `index.ts`, calls `store.createIssue()` with sources
- **`/triage` command** — simplified to: gather issues → interpolate prompt → `appendEntry`
- **`prompts/triage.md`** — updated to tell LLM to use the `create_batch` tool when user confirms
- **Delete** — all UI prompt logic in `handleTriageCommand` (input/select/editor calls)

## Testing Strategy

- **Tool handler unit test** — mock store, call tool execute, verify `createIssue` called with correct params
- **`/triage` command test** — verify it reads open issues and appends the interpolated prompt
- **Prompt template test** — verify `{{open_issues}}` interpolation produces expected output
- **Integration** — manually run `/triage` with real open issues, confirm LLM proposes batches, confirm tool creates them
