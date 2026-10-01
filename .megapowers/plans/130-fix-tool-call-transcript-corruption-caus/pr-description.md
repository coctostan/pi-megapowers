## Summary

Prevent workflow transitions from corrupting Pi's tool-call transcript and triggering provider errors such as `No tool call found for function call output`.

Megapowers was resetting canonical session storage from inside tool execution, after the assistant call had been persisted but before its result was recorded. The next provider request therefore contained an orphaned result.

## Changes

- Remove raw session resets from `megapowers_signal` and `megapowers_plan_review`, along with obsolete `triggerNewSession` metadata.
- Preserve existing phase gates, task/TDD sequencing, backward artifact versioning, and plan-review effects.
- Replace reset-required tests with transcript invariants across all affected transitions, both sibling-result orders, nested outer calls, validation errors, and non-transition controls.
- Update tool descriptions, next-step feedback, and documentation to state the session-preserving policy; add reproducible isolated host/provider smoke checks.

## Session behavior

Transitions now retain the current session. Use `/new` between agent runs for clean context; the next agent start rebuilds phase/task guidance from disk. Reload the updated extension before using transitions. This prevents new corruption but does not repair historical orphaned transcripts.

## Validation

- `bun test`: **868 passed, 0 failed** across 85 files.
- Persistence matrix: **56 fixtures** covering 14 workflow/control cases across direct, mixed-batch, and nested layouts.
- Real installed Pi **0.99.2** manager: pre-fix HEAD reproduces an orphan; corrected source preserves the session and call/result pair.
- Subsequent agent-start context correctly identifies the next task.
- Fresh live **OpenAI Codex / gpt-5.5** session completes a transition, follow-up read, and final reply without restart or orphaned results.
- **Anthropic live validation remains unverified:** attempted smoke was blocked by usage quota.
- `git diff --check`: passed.

Addresses local Megapowers issue #130. Detailed evidence is in `.megapowers/plans/130-fix-tool-call-transcript-corruption-caus/verify.md`.
