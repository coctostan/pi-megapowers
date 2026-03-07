---
id: 107
type: feature
status: open
created: 2026-03-07T14:57:33.663Z
sources: [95]
milestone: M3
priority: 2
---
# Add project chain definitions for draft-assist and review-fanout planning workflows
## Problem

Even with planning-specific agents, there is no reusable project-level orchestration for draft assist or review fan-out.

## Scope

Add project `.chain.md` definitions that encode the recommended subagent-assisted planning workflows.

Minimum chains/patterns:
- draft assist chain: `plan-scout -> planner` (or equivalent planning synthesizer)
- review assist chain or documented parallel pattern that fans out to `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`

## Acceptance criteria

1. At least one project chain file exists for draft assistance under `.pi/agents/`.
2. The review decomposition pattern is captured in a reusable chain file or documented project-level invocation pattern.
3. Chain/task prompts use bounded artifact names consistently (`context.md`, `coverage-review.md`, etc.).
4. The chain definitions keep final megapowers tool calls in the main session rather than delegating them to subagents.
