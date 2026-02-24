# Spec: Subagent Implementation Reliability

## Goal

Megapowers will register `subagent` and `subagent_status` custom tools that enable the parent LLM to delegate plan tasks to child pi sessions during any workflow phase. Each subagent runs in an isolated jj workspace with satellite TDD enforcement during implement phase, communicates progress via a status file protocol, and returns structured results (files changed via `jj diff`, test outcomes, error detection) so the parent can review diffs before squashing changes back. Agent definitions use markdown files with frontmatter for model/tool configuration.

## Acceptance Criteria

1. A `subagent` tool is registered via `pi.registerTool()` when megapowers initializes, accepting a task description, an optional agent name, and an optional task index referencing the current plan.

2. A `subagent_status` tool is registered via `pi.registerTool()` when megapowers initializes, accepting a subagent ID and returning the subagent's current state (running, completed, failed, timed out) plus any available results.

3. When `subagent` is called, a new jj workspace is created via `jj workspace add` with a unique name derived from the subagent ID, providing an isolated working copy for the child session.

4. The `subagent` tool spawns a detached `pi` process in the jj workspace directory with `PI_SUBAGENT=1` set in the environment, then returns immediately with the subagent ID (async-first dispatch).

5. The spawned pi subprocess writes a `status.json` file in a designated `.megapowers/subagents/<id>/` directory, updated as the subagent progresses (turns used, current phase, completion state).

6. `subagent_status` reads the status file and returns structured data: state (running/completed/failed/timed-out), files changed (from `jj diff --summary` on the workspace change), test pass/fail results, turns used, and any detected errors.

7. When a subagent completes successfully, `subagent_status` includes the `jj diff` output so the parent LLM can review what actually changed before deciding to squash.

8. The parent squashes a completed subagent's changes into the current change via `jj squash` only after explicit review — `subagent_status` returns the diff but does not auto-squash.

9. When a subagent finishes (success, failure, or timeout), its jj workspace is cleaned up via `jj workspace forget` regardless of exit path.

10. If the pi subprocess exits with a non-zero code, the subagent state is set to "failed", the workspace is cleaned up, and the error is included in the status result.

11. If a subagent exceeds a configurable timeout (default: 10 minutes), the process is killed, the workspace is cleaned up, and the subagent state is set to "timed-out".

12. Agent definitions are loaded from markdown files with YAML frontmatter containing `name`, `model`, `tools`, and `thinking` fields, searched in order: project `.megapowers/agents/` → user `~/.megapowers/agents/` → builtin agents bundled with the extension.

13. Three builtin agent files are provided: `worker.md` (general implementation), `scout.md` (research/exploration), and `reviewer.md` (code review), each with megapowers-appropriate model and tool defaults.

14. The agent frontmatter schema is compatible with pi-subagents format: fields `name` (string), `model` (string), `tools` (string array), `thinking` (string) are supported.

15. The `subagent` tool is available in all workflow phases, not gated to implement only.

16. During implement phase, child sessions run with satellite TDD enforcement (existing `isSatelliteMode()` detection via `PI_SUBAGENT=1` environment variable).

17. The plan parser (`extractPlanTasks`) supports an optional `[depends: N, M]` annotation on task lines, extracting dependency indices into a `depends` field on the returned `PlanTask` object.

18. When `subagent` is called with a task index, megapowers validates that all dependency tasks (from `[depends:]` annotations) are already completed before allowing the spawn.

19. Task context passed to subagents includes the relevant plan task section (description, file paths, test expectations) extracted from `plan.md`, so subagents can execute without the full spec.

20. Error detection parses the subagent's message stream for repeated failures, identifying stuck agents via heuristics (e.g., same error appearing 3+ times).

21. An `UPSTREAM.md` file is created in the extension directory documenting lineage to pi-subagents with a pinned commit reference.

## Out of Scope

- **Agent chains or pipelines** — subagents are independent, no chaining one subagent's output to another's input.
- **Agent manager UI** — no TUI panel for managing running subagents; status is via the tool only.
- **MCP integration** — no Model Context Protocol for subagent communication.
- **Session sharing** — parent and child sessions do not share conversation history.
- **Non-jj fallback** — jj is required; no git-only or no-VCS fallback path for workspace isolation.
- **Auto-squash** — the parent LLM must explicitly decide to squash; no automatic merge of subagent changes.
- **Cleaning up existing `isJJRepo()` guards** — that's a separate codebase-wide refactor tracked in the roadmap.

## Open Questions

None.
