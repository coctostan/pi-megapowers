---
id: 104
type: feature
status: done
created: 2026-03-07T14:57:33.655Z
sources: [95]
milestone: M3
priority: 2
---
# Add focused dependency-reviewer agent for plan ordering and hidden prerequisites
## Problem

Dependency/order analysis gets blurred together with coverage and task-quality review. Hidden prerequisites and forward references deserve their own bounded pass.

## Scope

Add a project-scoped `dependency-reviewer` agent in `.pi/agents/dependency-reviewer.md`.

The agent should:
- read task files plus the relevant repo context
- look for forward references, hidden prerequisites, unnecessary dependencies, and sequencing hazards
- write a bounded `dependency-review.md` artifact
- remain advisory only

## Acceptance criteria

1. `.pi/agents/dependency-reviewer.md` exists with a dependency/ordering-focused system prompt.
2. The prompt asks for concrete task-to-task findings, not generic architectural commentary.
3. The artifact format is bounded and easy for the main reviewer to synthesize.
4. The prompt explicitly states that final approve/revise decisions remain in the main session.
