# Spec: Triage LLM-Driven Batching

## Goal

Refactor the `/triage` command so batch creation is driven by the LLM instead of an interactive UI wizard. The command sends the open issues and triage instructions as a user message, the LLM proposes groupings conversationally, and when the user confirms, the LLM calls a `create_batch` tool to create batch issues.

## Acceptance Criteria

1. A `create_batch` tool is registered via `pi.registerTool()` with parameters: `title` (string), `type` ("bugfix" | "feature"), `sourceIds` (number[]), `description` (string).
2. The `create_batch` tool description is ≤ 20 words.
3. Calling `create_batch` creates an issue in the store with the given title, type, description, and source IDs.
4. `create_batch` returns the created issue's slug and ID on success.
5. `create_batch` returns an error message if any `sourceId` does not reference an existing open issue.
6. `create_batch` does not activate the created issue or change workflow state.
7. `/triage` gathers open issues that are not done and not themselves batch issues (no sources).
8. `/triage` interpolates the open issues into `prompts/triage.md` and sends the result as a user message via `pi.sendUserMessage()`.
9. `/triage` shows a notification when no open issues exist.
10. `/triage` does not use `ctx.ui.input`, `ctx.ui.select`, or `ctx.ui.editor`.
11. `prompts/triage.md` instructs the LLM to propose groupings for discussion before calling the tool.
12. `prompts/triage.md` instructs the LLM not to create single-issue batches.
13. `prompts/triage.md` instructs the LLM to use `create_batch` when the user confirms.

## Out of Scope

- Exposing `/issue`, `/done`, or other commands as tools (that's #027).
- Auto-activating batch issues after creation.
- Triage mode state flag or state machine changes.
- Modifying `store.createIssue` — it already accepts sources.

## Open Questions

