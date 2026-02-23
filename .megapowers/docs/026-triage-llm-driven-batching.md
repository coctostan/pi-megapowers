# Feature: Triage LLM-Driven Batching

## Summary
Refactored the `/triage` command from an interactive UI wizard to an LLM-driven conversational flow. The command now sends open issues and triage instructions as a user message, the LLM proposes groupings, and upon user confirmation calls the `create_batch` tool to create batch issues.

## Design Decisions
- **Tool-based batch creation:** Extracted batch creation logic into a `createBatchHandler` pure function in `tools.ts`, registered as a `create_batch` tool via `pi.registerTool()`. This lets the LLM create batches autonomously while keeping validation logic testable and decoupled from the extension wiring.
- **Discriminated union return type:** `createBatchHandler` returns `BatchResult | BatchError` — checked via `"error" in result` — avoiding exceptions for expected validation failures (missing/closed source IDs).
- **Pure triage helpers in ui.ts:** `filterTriageableIssues` and `formatTriageIssueList` are exported pure functions, keeping the `/triage` command handler in `index.ts` thin and the filtering/formatting independently testable.
- **No state mutation on batch creation:** `create_batch` only creates the issue in the store — it does not activate it, change the workflow phase, or modify `state.json`. This keeps triage a read-create operation with no side effects on the current workflow.
- **Prompt-driven conversation:** The `/triage` command uses `pi.sendUserMessage()` to inject the triage prompt, making the LLM drive the grouping conversation. No `ctx.ui.input`, `ctx.ui.select`, or `ctx.ui.editor` calls.

## API / Interface

### Tool: `create_batch`
- **Parameters:** `title` (string), `type` ("bugfix" | "feature"), `sourceIds` (number[]), `description` (string)
- **Returns:** Text with slug and ID on success, or error message if any sourceId is invalid/closed
- **Side effects:** Creates an issue in the store with the given sources. Does not activate it or change workflow state.

### Command: `/triage`
- Gathers open, non-done, non-batch issues (issues with no sources)
- Interpolates them into `prompts/triage.md` and sends as a user message
- Shows notification if no triageable issues exist

### Prompt: `prompts/triage.md`
- Instructs the LLM to group issues by type/code affinity, dependency, and complexity
- Requires discussion before creating batches
- Prohibits single-issue batches (minimum 2 source issues)
- Directs the LLM to call `create_batch` after user confirmation

## Testing
- `tests/tools.test.ts` — 5 tests covering happy path, slug/id return, missing source ID, done source ID, and state invariance
- `tests/ui.test.ts` — 3 tests for `filterTriageableIssues` (filtering done/batch issues, empty input) and `formatTriageIssueList` (format verification)
- `tests/prompts.test.ts` — 6 tests verifying the triage template loads, contains placeholder, interpolates correctly, references `create_batch`, includes discussion-first and no-single-batch instructions

## Files Changed
- `extensions/megapowers/tools.ts` — New file. `createBatchHandler` pure function with `BatchResult`/`BatchError` types.
- `extensions/megapowers/index.ts` — Added `create_batch` tool registration and `/triage` command using `pi.sendUserMessage()`.
- `extensions/megapowers/ui.ts` — Added `filterTriageableIssues` and `formatTriageIssueList` pure functions. Removed old wizard-based `handleTriageCommand`.
- `prompts/triage.md` — New file. LLM triage instructions with `{{open_issues}}` placeholder.
- `tests/tools.test.ts` — New file. 5 tests for `createBatchHandler`.
- `tests/ui.test.ts` — Added triage helper tests, removed dead wizard tests.
- `tests/prompts.test.ts` — Added triage template tests.
