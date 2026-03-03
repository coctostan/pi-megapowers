---
id: 91
type: feature
status: done
priority: 1
created: 2026-03-02T00:00:00.000Z
---

# Remove jj dependency from megapowers

## Motivation

jj (Jujutsu) was introduced for two purposes: VCS bookkeeping (per-phase/per-task change tracking) and subagent workspace isolation (via `jj workspace add`). In practice it has caused repeated problems:

- **Lost changes:** Batch issues get partially cherry-picked to PRs, leaving unmerged work on local jj branches that goes unnoticed (#086 changes to `pipeline-workspace.ts` and `hooks.ts` were lost this way).
- **Complexity overhead:** 19 production files and 15 test files reference jj. The `JJ` interface is threaded through `Deps`, `commands.ts`, `hooks.ts`, `ui.ts`, `tool-signal.ts`, `phase-advance.ts`, and every subagent module.
- **Session start friction:** jj availability checks, change ID sync, mismatch dialogs (`#061`), and install nag messages add startup latency and failure modes.
- **No parallel subagents yet:** The workspace isolation that justified jj is unused — all current subagent execution is sequential (pipeline tool runs implement→verify→review in series).

The [pi-subagents](https://github.com/nicobailon/pi-subagents) extension demonstrates that parallel subagent execution works without VCS isolation — agents are spawned as separate `pi` processes sharing the same `cwd`. File conflict prevention can be handled at dispatch time using the plan's `files_to_modify` metadata.

## Scope

### Delete entirely

| File | Role |
|------|------|
| `extensions/megapowers/jj.ts` | `JJ` interface, `createJJ()` factory |
| `extensions/megapowers/jj-messages.ts` | Install/init nag messages |
| `extensions/megapowers/task-coordinator.ts` | Per-task jj change creation, diff inspection |
| `extensions/megapowers/subagent/pipeline-workspace.ts` | `jj workspace add/squash/forget` |
| `tests/jj.test.ts` | JJ unit tests |
| `tests/pipeline-workspace.test.ts` | Workspace isolation tests |
| `tests/task-coordinator.test.ts` | Task coordinator tests |
| `tests/pipeline-diff.test.ts` | Pipeline diff tests |

### Remove jj from (keep file)

| File | What to remove |
|------|---------------|
| `extensions/megapowers/commands.ts` | `JJ` from `Deps` type, `createJJ()` call |
| `extensions/megapowers/hooks.ts` | jj availability check, change ID sync, nag messages |
| `extensions/megapowers/ui.ts` | `jj.newChange()` on issue start, `jjChangeId` display, `JJ` params |
| `extensions/megapowers/policy/phase-advance.ts` | jj change creation/squash in `advancePhase()` |
| `extensions/megapowers/tools/tool-signal.ts` | `JJ` param threading, task change tracking |
| `extensions/megapowers/register-tools.ts` | `execJJ` creation, jj-dependent tool descriptions |
| `extensions/megapowers/prompt-inject.ts` | `JJ` param (already unused — `_jj`) |
| `extensions/megapowers/satellite.ts` | jj workspace path comments/logic |
| `extensions/megapowers/state/state-machine.ts` | `jjChangeId` and `taskJJChanges` fields from state |
| `extensions/megapowers/state/state-io.ts` | `jjChangeId` and `taskJJChanges` from persisted keys |
| `extensions/megapowers/subagent/dispatcher.ts` | "jj workspace path" comment |
| `extensions/megapowers/subagent/oneshot-tool.ts` | `ExecJJ` param, workspace create/squash/cleanup calls |
| `extensions/megapowers/subagent/pipeline-tool.ts` | `ExecJJ` param, workspace create/squash calls |
| `extensions/megapowers/subagent/pipeline-runner.ts` | `ExecJJ` param, `getWorkspaceDiff()` calls |

### Update tests

| File | What changes |
|------|-------------|
| `tests/commands-phase.test.ts` | Remove `jj` mock from deps |
| `tests/hooks.test.ts` | Remove jj availability mocks |
| `tests/index-integration.test.ts` | Remove jj mocks |
| `tests/oneshot-tool.test.ts` | Replace `execJJ` with same-cwd spawning |
| `tests/phase-advance.test.ts` | Remove jj param from `advancePhase()` calls |
| `tests/pipeline-runner.test.ts` | Replace `execJJ`/workspace diff with new approach |
| `tests/pipeline-tool.test.ts` | Replace workspace create/squash with new approach |
| `tests/reproduce-086-bugs.test.ts` | Remove workspace-related tests |
| `tests/state-io.test.ts` | Remove `jjChangeId`/`taskJJChanges` from fixtures |
| `tests/state-machine.test.ts` | Remove jj state fields |
| `tests/tool-signal.test.ts` | Remove `jj` param from `handleSignal()` calls |
| `tests/ui.test.ts` | Remove `jj` mock from UI test deps |

## Subagent changes

The `pipeline` and `subagent` tools currently create jj workspaces for isolation. Replace with:

1. **Sequential execution (current behavior):** Run the subagent `pi` process in the same `cwd`. No isolation needed since steps are sequential.
2. **Future parallel execution:** Spawn multiple `pi` processes in the same `cwd` (pi-subagents pattern). Use `files_to_modify` from the plan to detect conflicts at dispatch time — reject parallel tasks that touch the same files.
3. **Diff capture:** Replace `jj diff` with `git diff` (or `git diff --cached` after staging). The project is already a git repo.

## Migration

- State files with `jjChangeId`/`taskJJChanges` fields should be handled gracefully (ignore on read, don't write).
- No user-facing migration needed — jj was always optional with graceful degradation.

## Out of scope

- Adding git branch management (users manage their own branches)
- Adding parallel subagent execution (separate issue)
- Replacing jj with git for phase/task bookkeeping (just remove it — state.json is sufficient)
