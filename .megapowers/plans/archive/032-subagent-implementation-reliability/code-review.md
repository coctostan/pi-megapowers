# Feature: Subagent Implementation Reliability

## Summary

Megapowers now registers `subagent` and `subagent_status` custom tools that let the parent LLM delegate plan tasks to child pi sessions during any workflow phase. Each subagent runs in an isolated jj workspace, communicates progress via a disk-based status file protocol, and returns structured results — files changed, test outcomes, full diff, detected errors — so the parent can review before squashing changes back. Agent definitions are markdown files with YAML frontmatter, searched in priority order from project to user home to builtin.

## Design Decisions

### Async-first dispatch

`subagent` returns immediately with an ID after spawning the child process. The parent polls `subagent_status` at its own cadence rather than blocking. This mirrors the existing `task_done` / status-file patterns already in megapowers and avoids per-request pi API timeouts on long-running tasks.

### Parent writes status, not child

The parent session streams the child's JSONL stdout and writes `status.json`. The child subprocess has no awareness of the file. This was chosen because (a) the child runs with `--mode json` outputting JSONL events, not raw status; (b) the parent can detect timeout and crash conditions the child can't self-report; (c) it avoids competing writes between parent and child. `updateSubagentStatus` uses merge semantics with a terminal-state guard and atomic temp-file-then-rename to prevent torn reads.

### jj workspace isolation per subagent

Each dispatch creates a `jj workspace add --name mega-<id>` at `.megapowers/subagents/<id>/workspace`. Cleanup via `jj workspace forget` always runs in the `close` handler after process exit — not in the timeout handler — to avoid a race where cleanup fires before the process fully exits. SIGTERM→SIGKILL escalation (5 s) matches the upstream pi subagent example.

### Satellite TDD reads from project root

Subagent workspaces are jj working copies, not the project root. Without correction, `readState()` in satellite mode would see an empty `.megapowers/` and `canWrite()` would pass through everything. The fix: `buildSpawnEnv` always sets `MEGA_PROJECT_ROOT` to the parent's `ctx.cwd`, and `satellite.ts` exposes `resolveProjectRoot()` which the satellite `tool_call` and `tool_result` handlers use instead of `ctx.cwd` when reading state.

### Prompt via @file reference

The task prompt is written to `.megapowers/subagents/<id>/prompt.md` and passed as `@<path>` to pi rather than inline on the command line. This avoids OS argument-length limits on large plan sections or learnings.

### isTestCommand gate for test detection

`processJsonlLine` only sets `lastTestPassed` when the correlated `tool_execution_start` command matches a known test runner pattern (`bun test`, `jest`, `vitest`, etc.). Without this gate, `grep` output containing "pass"/"fail" strings would produce false test results.

### Agent name safety

`resolveAgent` validates agent names against `/^[A-Za-z0-9_-]+$/` before constructing file paths, preventing path traversal via names like `../worker`. An explicit "not found" error is returned when a named agent can't be resolved in any search directory.

### No auto-squash

`subagent_status` returns `diff` and `filesChanged` but never calls `jj squash`. The parent LLM must read the diff and squash explicitly. This is enforced structurally: `buildWorkspaceSquashArgs` exists but is not called from any status handler.

### Dependency validation requires a plan

When `taskIndex` is provided, `validateTaskDependencies` is called with the derived task list. If the plan is missing or unparseable (empty task list), dispatch fails with a clear error rather than silently bypassing dependency checks.

### AC17 was pre-existing

The `[depends: N, M]` plan annotation parser already existed in `plan-parser.ts` with full coverage. No new code was needed; the feature simply calls `deriveTasks()` and passes the resulting `dependsOn` fields to `validateTaskDependencies`.

## API / Interface

### Tools registered

**`subagent`**
```
task        string    required  Task description for the subagent
taskIndex   number    optional  Plan task index (validates [depends:] annotations)
agent       string    optional  Agent name to use (default: worker)
timeoutMs   number    optional  Timeout in ms (default: 600000 = 10 min)
```
Returns: `Subagent dispatched: <id>\nWorkspace: mega-<id>\nUse subagent_status to check progress.`

**`subagent_status`**
```
id   string   required   Subagent ID returned from the subagent tool
```
Returns: JSON-serialised `SubagentStatus`:
```ts
{
  id: string
  state: "running" | "completed" | "failed" | "timed-out"
  turnsUsed: number
  startedAt: number          // epoch ms
  completedAt?: number
  phase?: string             // workflow phase at dispatch time
  filesChanged?: string[]    // from jj diff --summary
  diff?: string              // full jj diff patch (inline, ≤100 KB)
  diffPath?: string          // path to diff.patch if >100 KB
  testsPassed?: boolean
  error?: string
  detectedErrors?: string[]  // repeated errors (≥3 occurrences)
}
```

### Agent definition format

Markdown files with YAML frontmatter, compatible with pi-subagents:
```yaml
---
name: worker
model: claude-sonnet-4-20250514
tools: [read, write, edit, bash]
thinking: full
---

System prompt text here.
```
Search order: `.megapowers/agents/<name>.md` → `~/.megapowers/agents/<name>.md` → `agents/<name>.md` (builtin).

### Plan annotation

Tasks may declare dependencies with `[depends: N, M]`:
```markdown
### Task 3: Integration [depends: 1, 2]
```
Dispatch of task 3 is blocked until tasks 1 and 2 are in `completedTasks`.

### Environment variables (child process)

| Variable | Value | Purpose |
|---|---|---|
| `PI_SUBAGENT` | `1` | Activates satellite mode (TDD-only enforcement) |
| `MEGA_SUBAGENT_ID` | `<id>` | Subagent identity |
| `MEGA_PROJECT_ROOT` | `<cwd>` | Project root for `readState()` in satellite handlers |

### Status file location

`.megapowers/subagents/<id>/status.json` — written atomically by parent, read by `subagent_status`.

## Testing

546 tests pass across 31 files. Ten new test files cover the subagent subsystem:

| File | What it tests |
|---|---|
| `subagent-agents.test.ts` | `parseAgentFrontmatter` (all tools formats, missing fields, null cases), `resolveAgent` priority order, path traversal rejection, builtin file existence, `UPSTREAM.md` presence |
| `subagent-async.test.ts` | `DEFAULT_TIMEOUT_MS` value, `buildDispatchConfig` defaults and overrides |
| `subagent-context.test.ts` | `extractTaskSection` for `### Task N:` headers and numbered lists, `buildSubagentPrompt` composition |
| `subagent-errors.test.ts` | `detectRepeatedErrors` thresholds, deduplication, empty input, configurable threshold |
| `subagent-runner.test.ts` | `generateSubagentId` uniqueness and task-index embedding, `buildSpawnArgs` flags, `buildSpawnEnv` variables, `processJsonlLine` turn counting / test detection / error harvesting / `isTestCommand` gate |
| `subagent-status.test.ts` | Atomic write+read roundtrip, terminal-state guard, merge semantics, all status field types |
| `subagent-tools.test.ts` | Dispatch error paths (disabled, no issue, no jj, unknown agent, invalid timeout, dep not met, no plan), happy-path dispatch, prompt written to file, all 9 phases, no-auto-squash, JSON output, satellite TDD env vars |
| `subagent-validate.test.ts` | Dep validation: no deps, all met, partial unmet, unknown task, empty plan |
| `subagent-workspace.test.ts` | All jj arg builders, `workspacePath`, cleanup contract property test |
| `satellite-root.test.ts` | `resolveProjectRoot` with/without `MEGA_PROJECT_ROOT` |

Notable edge cases covered: path traversal in agent names, false-positive test detection from `grep` output, `isTerminal` race guard preventing double-write, empty `[depends:]` annotation backward compatibility, corrupt `status.json` returning null.

## Files Changed

### New — extension modules
| File | Description |
|---|---|
| `extensions/megapowers/subagent-agents.ts` | `parseAgentFrontmatter`, `resolveAgent`, `BUILTIN_AGENTS_DIR`, `SAFE_AGENT_NAME` guard |
| `extensions/megapowers/subagent-async.ts` | `DEFAULT_TIMEOUT_MS`, `buildDispatchConfig`, `DispatchConfig` type |
| `extensions/megapowers/subagent-context.ts` | `extractTaskSection`, `buildSubagentPrompt` |
| `extensions/megapowers/subagent-errors.ts` | `detectRepeatedErrors`, `MessageLine` type |
| `extensions/megapowers/subagent-runner.ts` | `generateSubagentId`, `buildSpawnArgs`, `buildSpawnEnv`, `createRunnerState`, `processJsonlLine`, `RunnerState` type |
| `extensions/megapowers/subagent-status.ts` | `SubagentStatus` type, `writeSubagentStatus`, `readSubagentStatus`, `updateSubagentStatus`, `subagentDir` |
| `extensions/megapowers/subagent-tools.ts` | `handleSubagentDispatch`, `handleSubagentStatus`, `JJCheck` interface |
| `extensions/megapowers/subagent-validate.ts` | `validateTaskDependencies`, `ValidationResult` type |
| `extensions/megapowers/subagent-workspace.ts` | `buildWorkspaceName`, `workspacePath`, `buildWorkspaceAddArgs`, `buildWorkspaceForgetArgs`, `buildWorkspaceSquashArgs`, `buildDiffSummaryArgs`, `buildDiffFullArgs` |
| `extensions/megapowers/UPSTREAM.md` | Lineage to pi-subagents, pinned commit `1281c04` |

### New — builtin agents
| File | Description |
|---|---|
| `agents/worker.md` | General implementation agent: `claude-sonnet-4-20250514`, tools `[read, write, edit, bash]`, thinking `full` |
| `agents/scout.md` | Research/exploration agent: read-only tools `[read, bash]` |
| `agents/reviewer.md` | Code review agent: read-only tools `[read, bash]` |

### New — tests
| File | Description |
|---|---|
| `tests/subagent-agents.test.ts` | Frontmatter parsing, agent resolution, builtin file existence, UPSTREAM.md |
| `tests/subagent-async.test.ts` | Dispatch config defaults and overrides |
| `tests/subagent-context.test.ts` | Task section extraction, prompt building |
| `tests/subagent-errors.test.ts` | Repeated error detection |
| `tests/subagent-runner.test.ts` | JSONL stream processing, spawn arg/env builders |
| `tests/subagent-status.test.ts` | Status file protocol, merge semantics, atomic writes |
| `tests/subagent-tools.test.ts` | Dispatch and status handlers, all phases, safety validations |
| `tests/subagent-validate.test.ts` | Dependency validation |
| `tests/subagent-workspace.test.ts` | jj command arg builders |
| `tests/satellite-root.test.ts` | `resolveProjectRoot` with/without env var |

### Modified — existing modules
| File | Change |
|---|---|
| `extensions/megapowers/index.ts` | Registered `subagent` and `subagent_status` tools; added async dispatch block with jj lifecycle, JSONL streaming, timeout/cleanup; added subagent imports |
| `extensions/megapowers/satellite.ts` | Added `resolveProjectRoot()` export for `MEGA_PROJECT_ROOT` lookup |
| `extensions/megapowers/subagent-agents.ts` | Added `SAFE_AGENT_NAME` validation (code review fix) |
| `extensions/megapowers/subagent-tools.ts` | Added unknown-agent and invalid-`timeoutMs` guards (code review fix) |
| `extensions/megapowers/state-machine.ts` | Added `dependsOn?: number[]` field to `PlanTask` type |
| `extensions/megapowers/plan-parser.ts` | Added `[depends: N, M]` annotation parsing into `PlanTask.dependsOn` |
| `extensions/megapowers/store.ts` | Added `readPlanFile()` helper used by subagent context assembly |
| `extensions/megapowers/task-coordinator.ts` | Added `parseTaskDiffFiles()` used by diff summary parsing |
