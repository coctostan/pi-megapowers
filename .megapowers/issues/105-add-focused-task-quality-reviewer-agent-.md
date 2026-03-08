---
id: 105
type: feature
status: done
created: 2026-03-07T14:57:33.658Z
sources: [95]
milestone: M3
priority: 2
---
# Add focused task-quality-reviewer agent for TDD completeness and self-containment
## Problem

Task-level realism and self-containment are easy to miss when they compete for attention with coverage and ordering concerns.

## Scope

Add a project-scoped `task-quality-reviewer` agent in `.pi/agents/task-quality-reviewer.md`.

The agent should:
- inspect task bodies for complete steps, realistic commands/errors, real file paths, and self-contained code
- produce a bounded `task-quality-review.md` artifact
- focus on per-task findings, not overall verdict ownership

## Acceptance criteria

1. `.pi/agents/task-quality-reviewer.md` exists with a task-quality-focused prompt.
2. The output format is per-task and bounded.
3. The prompt emphasizes concrete findings tied to steps/paths/APIs rather than vague quality judgments.
4. The prompt explicitly states that the main session owns the final review verdict.
