---
id: 32
type: feature
status: open
created: 2026-02-23T17:33:56.358Z
sources: [10, 25]
---

# Subagent implementation & reliability

Package the subagent tool within megapowers (#025) and fix parallel subagent failures (#010) as one effort. Owning the subagent lifecycle means designing it with proper state isolation, concurrency-safe file access, and TDD guard scoping so parallel invocations don't corrupt shared state.
