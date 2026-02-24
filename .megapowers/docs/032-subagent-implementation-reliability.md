Done. Feature document saved to `.megapowers/plans/032-subagent-implementation-reliability/generate-docs.md`.

---

# Feature: Subagent Implementation Reliability

## Summary
Megapowers registers `subagent` and `subagent_status` custom tools that delegate plan tasks to child pi sessions, each running in an isolated jj workspace, reporting structured results back for parent review before squash.

## Key design choices

| Decision | Rationale |
|---|---|
| **Parent writes `status.json`** | Child runs `--mode json` (JSONL), can't self-report crashes/timeouts |
| **Async-first / poll-based** | `subagent` returns an ID immediately; avoids API timeouts on long tasks |
| **Cleanup in `close` handler only** | Timeout handler only kills the process; cleanup runs after exit to avoid cleanup-before-exit race |
| **`@file` prompt reference** | Avoids OS CLI arg-length limits on large plan sections |
| **`isTestCommand` gate** | Prevents `grep` output with "pass"/"fail" strings from triggering false test results |
| **`MEGA_PROJECT_ROOT` env var** | Subagent `cwd` is a jj workspace copy, not the project root; satellite TDD needs real `state.json` |
| **`SAFE_AGENT_NAME` regex** | Blocks path traversal via agent names like `../worker` |
| **No auto-squash** | `buildWorkspaceSquashArgs` exists but is structurally never called from `subagent_status` |

## New files: 10 modules + 3 builtin agents + 10 test files

Test suite: **546 pass / 0 fail**