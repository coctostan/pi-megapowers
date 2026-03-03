# Spec: Subagent Robustness — Agent Optimization & jj Prerequisites

## Goal

Improve subagent reliability and quality by (1) adding jj installation detection at session start with clear install/setup guidance so users aren't blindsided at dispatch time, improving the subagent error message with actionable instructions, and (2) optimizing builtin agent definitions with differentiated models/thinking levels (already done), substantial multi-paragraph system prompts that include workflow guidance, phase-aware context, and structured output expectations.

## Acceptance Criteria

1. On `session_start`, if jj is not installed (`jj version` fails), a warning is displayed via `ctx.ui.notify` that includes install instructions for at least brew and cargo (`brew install jj`, `cargo install jj-cli`).

2. On `session_start`, if jj is installed but the project is not a jj repository, a warning is displayed suggesting `jj git init --colocate` for existing git repos.

3. On `session_start`, if jj is installed and the project is a jj repo, no jj-related warning is displayed.

4. The jj session-start checks are informational only — they do not block session initialization or prevent any megapowers functionality from loading.

5. When `handleSubagentDispatch` returns a jj-not-available error, the error message includes install instructions (`brew install jj`, `cargo install jj-cli`) and setup guidance (`jj git init --colocate`), not just "This does not appear to be a jj repository."

6. The worker agent system prompt includes at least 3 paragraphs covering: task execution approach, TDD workflow expectations (write tests first, run them, then implement), and how to signal completion.

7. The scout agent system prompt includes at least 3 paragraphs covering: investigation approach, how to structure findings (summaries with file paths and line references), and depth vs breadth guidance.

8. The reviewer agent system prompt includes at least 3 paragraphs covering: review methodology, what constitutes blocking vs non-blocking issues, and how to format feedback (specific file/line references, severity levels).

9. `buildSubagentPrompt` injects the current phase name into the subagent's task context so agents can adapt behavior based on workflow stage.

10. `buildSubagentPrompt` includes the project's spec or diagnosis content (when available) so subagents have acceptance criteria context during implement and verify phases.

11. Each builtin agent (worker, scout, reviewer) has a distinct model and thinking level configured in its frontmatter — no two agents share the same model+thinking combination.

12. Agent resolution still follows the priority order: project `.megapowers/agents/` → user `~/.megapowers/agents/` → builtin `agents/` directory, with no changes to the resolution mechanism.

## Out of Scope

- New agent types (planner, test writer, documenter, refactorer) — evaluate after existing agents are optimized.
- Agent chaining or pipelines.
- Dynamic per-phase prompt augmentation at the agent definition level (phase context is injected via `buildSubagentPrompt`, not by rewriting agent `.md` files).
- Fixing jj colocate detached HEAD issue with pi (that's a pi-core concern, not megapowers).
- Custom agent UI/management.
- Changes to agent resolution mechanism or frontmatter parsing.

## Open Questions

None.
