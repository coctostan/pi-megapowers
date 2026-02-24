# Brainstorm: Subagent Implementation Reliability

## Problem
During the implement phase, megapowers prompts suggest delegating independent tasks to subagents, but no subagent tool exists. The satellite detection code (satellite.ts) handles the child side, but nothing spawns subagents from the parent session.

## Approach

Megapowers will register a `subagent` tool and a `subagent_status` tool that enable the parent LLM to delegate work to child pi sessions. The implementation adapts core patterns from pi-subagents (async runner, status protocol, agent discovery, error detection) into a right-sized megapowers-native module, adding jj workspace isolation for parallel execution and satellite TDD enforcement for implement-phase tasks. Agent markdown files with frontmatter (compatible with pi-subagents format) allow model/tool selection per agent type.

The subagent tool uses **async-first dispatch**: it spawns a detached `pi` process in an isolated `jj workspace`, returns immediately with an ID, and the parent LLM uses `subagent_status` to poll progress and collect results. This gives the parent intermittent visibility and prevents the "stuck subagent" problem. When a subagent completes, the parent runs `jj diff` on its workspace change to verify what actually changed before squashing it back.

Plan tasks are written to be self-contained (file paths, test code, implementation approach) so subagents can execute from the plan section alone without needing the full spec. The plan prompt's `[depends: N, M]` annotations provide the dependency graph for safe parallel dispatch. jj is treated as a required dependency — no fallback paths.

## Key Decisions

- **Adapt patterns from pi-subagents, build lean** — Cherry-pick async runner, status protocol, agent discovery, error detection. Skip chains, agent manager UI, MCP, session sharing. ~800-1200 lines vs 14K.
- **jj is a required dependency** — Enables workspace isolation for parallel subagents. No optional fallback. Roadmap note to clean up all existing `isJJRepo()` guards across the codebase.
- **jj workspace isolation** — Each parallel subagent gets its own working copy via `jj workspace add`. Zero filesystem contention. Parent squashes changes back after review.
- **Async-first dispatch with status polling** — `subagent` returns immediately with an ID. `subagent_status` tool lets parent check progress, detect stuck agents, collect results.
- **Structured results with jj diff as ground truth** — Tool result includes: files changed (from jj diff), test results, turns used, error detection. Parent LLM gets actionable data, not just prose.
- **Available in all phases** — No phase gating on the subagent tool. Satellite TDD enforcement applies contextually only during implement phase.
- **Compatible agent frontmatter format** — Same schema as pi-subagents (name, model, tools, thinking). Users' existing agent files work.
- **UPSTREAM.md tracking** — Document lineage to pi-subagents with pinned commit. Periodic audit for improvements to shared patterns.
- **LLM decides what to delegate, megapowers validates** — Parent LLM chooses tasks. Megapowers validates dependency constraints before spawning.
- **Cleanup on all exit paths** — `jj workspace forget` runs regardless of success, timeout, or crash.

## Components

- **`subagent-runner.ts`** — Core execution: spawn pi subprocess, stream events, write status.json, handle timeout/abort
- **`subagent-agents.ts`** — Agent discovery from markdown files with frontmatter (project → user → builtin priority)
- **`subagent-async.ts`** — Async dispatch: detach process, write config, status file protocol
- **`subagent-workspace.ts`** — jj workspace lifecycle: create, diff, squash, forget, conflict detection
- **`subagent-tools.ts`** — Tool registration: `subagent` (dispatch) and `subagent_status` (poll/collect)
- **`subagent-errors.ts`** — Error detection: recovery-aware error checking from message stream
- **`subagent-context.ts`** — Task context assembly: extract plan section, inject learnings, set env vars
- **Builtin agents** — `agents/worker.md`, `agents/scout.md`, `agents/reviewer.md` with megapowers-appropriate defaults
- **Prompt updates** — Update implement/plan prompts to reference subagent delegation with self-contained task descriptions

## Error Handling

| Failure | Recovery |
|---------|----------|
| Subagent times out | Kill process, `jj workspace forget`, return error to parent LLM |
| Subagent fails TDD | Satellite TDD blocks it. Returns incomplete result. Parent finishes inline |
| Subagent edits wrong files | Parent reviews `jj diff` before squashing. Can abandon the change |
| jj merge conflicts | jj surfaces conflicts. Parent LLM or human resolves |
| pi subprocess crashes | Non-zero exit → clean up workspace → return error to parent |

## Testing Strategy

- **Unit tests for pure functions**: agent frontmatter parsing, dependency graph validation, context assembly, error detection heuristics, status file parsing
- **Unit tests for jj workspace logic**: mock jj commands, test create/diff/squash/forget lifecycle, conflict detection
- **Integration tests for runner**: mock pi subprocess (write expected JSONL to stdout), verify status file protocol, timeout handling, cleanup on all exit paths
- **Write policy tests**: verify satellite TDD only applies during implement phase subagents, not during brainstorm/spec/review subagents
- **Plan parser extension**: test `[depends: N, M]` annotation extraction for dependency graph

## References

- **pi-subagents** (github.com/nicobailon/pi-subagents) — Async runner, status protocol, agent discovery, error detection patterns
- **pi example subagent extension** — Core pi spawn mechanics, JSONL streaming
- **Existing megapowers modules** — satellite.ts (child detection), task-coordinator.ts (jj change tracking), jj.ts (VCS integration)

## Roadmap Notes

- jj should become a required dependency across all of megapowers. Clean up all `isJJRepo()` optional guards. Explore where jj can be better leveraged (conflict resolution, change inspection, bisect).
- Update ROADMAP.md with jj requirement and subagent feature tracking.
