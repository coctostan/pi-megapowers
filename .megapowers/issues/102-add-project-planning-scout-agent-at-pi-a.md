---
id: 102
type: feature
status: open
created: 2026-03-07T14:57:10.135Z
sources: [95]
milestone: M3
priority: 2
---
# Add project planning scout agent at .pi/agents/plan-scout.md
## Problem

Planning sessions are overloaded because repo discovery and task authoring happen in the same context window.

## Scope

Add a project-scoped `plan-scout` agent in `.pi/agents/plan-scout.md` that produces bounded planning context before task drafting.

The agent should:
- read spec/diagnosis plus relevant repo files
- identify existing APIs, tests, conventions, and likely task boundaries
- write a compact `context.md` artifact suitable for a planning handoff
- remain advisory only (no megapowers state transitions, no task writing)

## Acceptance criteria

1. `.pi/agents/plan-scout.md` exists with frontmatter and a planning-specific system prompt.
2. The prompt defines a bounded output format focused on acceptance criteria mapping, key files, conventions, risks, and suggested task slices.
3. The agent is read-heavy/advisory and does not claim ownership of plan-writing tools or workflow transitions.
4. The design doc or usage notes reference how `context.md` is intended to be consumed by the main planning session.
