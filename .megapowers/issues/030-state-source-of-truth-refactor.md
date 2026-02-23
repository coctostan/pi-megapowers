---
id: 30
type: feature
status: in-progress
created: 2026-02-23T17:33:56.357Z
sources: [6, 17, 19, 21, 23, 24, 28, 29]
---

# State source of truth refactor

The runtime in-memory state silently overwrites file state, making parser detection and task tracking unreliable. This batch refactors the entire state pipeline: file state becomes authoritative (read-before-write), implement phase re-derives planTasks from plan.md, session recovery re-parses from artifacts, and parser/signal detection fixes (#023 "None" as open question, #024 review approval regex, #006 acceptance criteria extraction) come along naturally when reworking the prompt-to-parser-to-state contracts. Touches artifact-router.ts, store.ts, index.ts, state-recovery.ts, spec-parser.ts, gates.ts, and plan-parser.ts.
