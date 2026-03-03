## 2026-02-24 — Subagent tools: delegate plan tasks to child pi sessions

- Added `subagent` tool that spawns an isolated child pi session to work on a task description, returning an ID immediately so the parent session can continue other work while the subagent runs.
- Added `subagent_status` tool that returns the subagent's current state (`running`, `completed`, `failed`, `timed-out`), files changed, test pass/fail, and the full `jj diff` for review before squashing — nothing is merged automatically.
- Agent behavior is configurable via markdown files with YAML frontmatter (`name`, `model`, `tools`, `thinking`); three builtins ship out of the box: `worker` (implementation), `scout` (read-only research), and `reviewer` (read-only code review). Custom agents override builtins when placed in `.megapowers/agents/`.
- Plan tasks can declare `[depends: N, M]` annotations; `subagent` enforces that all listed dependency tasks are completed before dispatching, preventing out-of-order parallel work.
- During implement phase, child sessions run with the same TDD write guard as the parent session.
