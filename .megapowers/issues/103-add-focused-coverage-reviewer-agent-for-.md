---
id: 103
type: feature
status: open
created: 2026-03-07T14:57:10.138Z
sources: [95]
milestone: M3
priority: 2
---
# Add focused coverage-reviewer agent for plan review fan-out
## Problem

A single plan review session must check coverage, dependency correctness, and per-task realism all at once. Coverage analysis is a distinct concern and can be separated cleanly.

## Scope

Add a project-scoped `coverage-reviewer` agent in `.pi/agents/coverage-reviewer.md`.

The agent should:
- read the spec/diagnosis and current task files
- produce a bounded `coverage-review.md` artifact
- identify missing or weak AC/task mappings
- stay advisory only; the main session still owns the final review verdict

## Acceptance criteria

1. `.pi/agents/coverage-reviewer.md` exists with a prompt dedicated to acceptance-criteria coverage analysis.
2. The output format is concrete and bounded (e.g. AC-by-AC findings + task references).
3. The prompt explicitly avoids claiming final review authority.
4. The artifact name/location is documented consistently with the broader planning design.
