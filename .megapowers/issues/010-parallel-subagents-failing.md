---
id: 10
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# Parallel subagents fail (2-4 out of 4)

When subagents are actually invoked in parallel, a majority of them fail. 4 subagents were launched and 2-4 of them failed. Root cause unknown — could be:

- Race conditions on shared state (state.json, plan files)
- TDD guard blocking writes across concurrent sessions
- File system conflicts (multiple agents writing to overlapping paths)
- Subagent session context missing required state

Needs reproduction and diagnosis to determine which failure mode(s) are occurring.
