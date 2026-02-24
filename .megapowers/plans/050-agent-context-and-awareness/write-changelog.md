## [2026-02-24] — Agent Context and Awareness

- **Base prompt when no issue is active:** The agent now receives Megapowers tool orientation and Getting Started guidance even before selecting an issue.
- **Docs/config files writable in all phases:** Markdown, JSON, YAML, `.env`, `.d.ts`, and other safe files can now be edited in every workflow phase.
- **Type-only task guidance:** Plan-phase prompts instruct the agent to annotate non-testable tasks with `[no-test]`, and implement-phase prompts document `/tdd skip` as an escape hatch.
- **Template variable safety net:** Automated tests verify that every prompt template's `{{variables}}` are fully populated before injection.
