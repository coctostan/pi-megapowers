# Spec: Remove jj Dependency

## Goal

Remove all jj (Jujutsu) version control integration from megapowers and replace the subagent workspace isolation mechanism with git worktrees. This eliminates the jj install/repo requirement, removes all per-phase and per-task jj bookkeeping (change IDs, bookmarks, describe/new/squash operations), and rewrites `pipeline-workspace.ts` to use `git worktree` for isolated subagent execution — preserving the same public API and injectable executor testability pattern.

## Acceptance Criteria

1. `jj.ts` and `jj-messages.ts` files are deleted from the codebase
2. `MegapowersState` type no longer contains `jjChangeId` or `taskJJChanges` fields
3. `state-io.ts` serialization round-trips state without jj fields — existing `state.json` files containing `jjChangeId`/`taskJJChanges` are silently ignored on read and dropped on write
4. `hooks.ts` no longer checks for jj availability or detects jj change ID mismatches
5. `commands.ts` no longer imports `createJJ` or includes `jj` in its deps type or `ensureDeps`
6. `ui.ts` no longer renders jj change IDs or jj integration in issue/triage commands
7. `tool-signal.ts` no longer accepts or threads a `jj` parameter and does not create task changes via jj
8. `phase-advance.ts` no longer calls jj describe, jj new, or jj squash on phase transitions
9. `task-coordinator.ts` no longer exports `createTaskChange` or `inspectTaskChange`
10. `prompt-inject.ts` no longer accepts a `_jj` parameter
11. `register-tools.ts` no longer creates an `execJJ` executor or registers jj-related tool descriptions
12. No remaining imports of `jj.ts` or `jj-messages.ts` exist anywhere in the codebase
13. `pipeline-workspace.ts` exports an `ExecGit` type (replacing `ExecJJ`) with the same `(args: string[]) => Promise<{ stdout, stderr }>` shape
14. `createPipelineWorkspace` calls `git worktree add --detach <path>` to create an isolated worktree
15. `squashPipelineWorkspace` runs `git add -A` and `git diff --cached HEAD` in the worktree to produce a patch, then `git apply` in the main working directory, then `git worktree remove`
16. `squashPipelineWorkspace` returns `{ error }` with a descriptive message when any git command fails, and preserves the worktree for inspection on squash failure
17. `cleanupPipelineWorkspace` calls `git worktree remove --force` and returns `{ error }` on failure
18. `getWorkspaceDiff` calls `git add -A`, `git diff --cached HEAD --stat`, and `git diff --cached HEAD` in the worktree and returns the combined output
19. `pipeline-runner.ts`, `pipeline-tool.ts`, and `oneshot-tool.ts` use `ExecGit`/`execGit` instead of `ExecJJ`/`execJJ`
20. All corresponding `.test.ts` files pass with jj references removed and git workspace commands verified via mock executor
21. Workspace path remains `.megapowers/workspaces/<pipelineId>`

## Out of Scope

- Replacing git with any other VCS — git is the only target
- Adding parallel subagent execution (git worktrees enable it, but it's not part of this issue)
- Explicit state migration scripts — tolerance-based read/drop is sufficient
- Generic `ExecCmd` abstraction — the executor type is `ExecGit`, specific to git operations
- Changes to the pipeline public API (`create`, `squash`, `cleanup`, `getDiff` signatures stay the same beyond the executor type rename)
- Temporary branch management — worktrees use detached HEAD

## Open Questions

*(none)*
