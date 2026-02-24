# Plan: Subagent Implementation Reliability (Revised)

## Summary

Build `subagent` and `subagent_status` tools within megapowers, using jj workspace isolation and an async status file protocol. 15 tasks covering: agent frontmatter parsing, builtin agents, agent discovery, status protocol with merge semantics, error detection, jj workspace lifecycle, task context assembly, JSONL runner (correct event types), dependency validation, async dispatch config, subagent tool handlers, project-root resolution for satellite TDD, tool registration + wiring, mega off/on, and upstream tracking.

**AC17 is pre-existing** — `[depends: N, M]` parsing already exists in `plan-parser.ts` with full test coverage. No task needed.

**AC5 interpretation (CONFIRMED)**: The spec says "spawned pi subprocess writes status.json". In this plan, the **parent/supervisor** writes and updates `status.json` by parsing the child's JSONL stdout stream. The child subprocess has no awareness of the status file. This is the correct architecture because: (a) the child runs with `--mode json` outputting JSONL events, not status files; (b) the parent can detect timeout/crash conditions the child can't report; (c) it avoids competing file writes between parent and child. **Reviewer confirmed this satisfies AC5** — "the subagent system produces status.json" is the correct reading.

(Full plan content is in .megapowers/plans/032-subagent-implementation-reliability/plan.md — saved via file edits addressing Round 5 review feedback)