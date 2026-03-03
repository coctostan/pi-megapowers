# Brainstorm: Remove jj Dependency

## Approach

Remove all jj (Jujutsu) integration from megapowers and replace subagent workspace isolation with git worktrees. This is a two-part change done in one issue: a **deletion sweep** that removes all jj phase/task bookkeeping code, and a **replacement** that rewrites the subagent workspace module to use `git worktree` instead of `jj workspace`.

The deletion sweep is mechanical — remove `jj.ts`, `jj-messages.ts`, strip the `JJ` interface and `createJJ` factory, remove `jj?: JJ` parameters from all function signatures, remove `jjChangeId` and `taskJJChanges` from `MegapowersState`, and clean up all call sites in hooks, commands, UI, tool-signal, phase-advance, and task-coordinator. This eliminates the jj install requirement, the jj repo init requirement, change ID mismatch detection, and all per-phase/per-task jj bookkeeping.

The replacement rewrites `pipeline-workspace.ts` to use git. The module's public API stays the same — `create`, `squash`, `cleanup`, `getDiff` — but the implementation uses `git worktree add --detach` for isolation, `git diff` for change capture, `git apply` for squash-back, and `git worktree remove` for cleanup. The injectable `ExecJJ` type becomes `ExecGit` with the same shape, preserving the existing testability pattern where tests inject a mock executor.

## Key Decisions

- **One issue, both parts** — No awkward intermediate state where jj is required only for subagents. Clean cut.
- **git worktree for isolation** — Preserves the isolation guarantees subagent pipelines depend on. Supports future parallel execution. No new install requirements (project is already a git repo).
- **Detached HEAD worktrees** — `git worktree add --detach` avoids branch management entirely. No temp branches to create or clean up.
- **Patch-based squash** — `git add -A && git diff --cached HEAD` in the worktree produces a patch; `git apply` in main applies it. Handles new files, modifications, deletions, and renames cleanly.
- **`ExecGit` not `ExecCmd`** — YAGNI. The type is specifically for git operations in the workspace module. Rename later if generic process execution is needed.
- **State migration via tolerance** — Existing `state.json` with `jjChangeId`/`taskJJChanges` just gets those fields ignored on read and dropped on next write. No explicit migration step.
- **Workspace path**: `.megapowers/workspaces/<pipelineId>` — same pattern as current jj workspaces.

## Components

### Delete
- **`jj.ts`** — entire file (JJ interface, createJJ, checkJJAvailability, formatChangeDescription)
- **`jj-messages.ts`** — entire file
- **`state-machine.ts`** — remove `jjChangeId`, `taskJJChanges` fields and their initialization/reset logic
- **`state-io.ts`** — remove jj fields from serialization keys
- **`hooks.ts`** — remove jj availability check, change ID mismatch detection, jj import
- **`commands.ts`** — remove `createJJ`, jj from deps type and `ensureDeps`
- **`ui.ts`** — remove jj change display, jj integration in issue/triage commands
- **`tool-signal.ts`** — remove jj parameter threading, task change creation
- **`phase-advance.ts`** — remove jj describe/new/squash on phase transitions
- **`task-coordinator.ts`** — remove `createTaskChange`, `inspectTaskChange`
- **`prompt-inject.ts`** — remove `_jj` parameter
- **`register-tools.ts`** — remove jj tool descriptions and `execJJ` creation
- **`satellite.ts`** — update comments referencing jj workspaces

### Replace
- **`pipeline-workspace.ts`** — rewrite: `ExecJJ` → `ExecGit`, implementations use git worktree commands
- **`pipeline-runner.ts`** — update imports: `ExecJJ` → `ExecGit`
- **`pipeline-tool.ts`** — update imports and `execJJ` → `execGit` parameter
- **`oneshot-tool.ts`** — update imports and `execJJ` → `execGit` parameter
- **`register-tools.ts`** — `execJJ` → `execGit`, change `pi.exec("jj", ...)` to `pi.exec("git", ...)`

### Update Tests
- All corresponding `.test.ts` files updated to match new signatures and remove jj-specific test cases
- pipeline-workspace tests verify git worktree command sequences via mock executor

## Testing Strategy

- **Deletion sweep tests**: For each modified module, verify that jj-related code paths are gone. Functions that previously accepted `jj?: JJ` now work without it. State serialization round-trips without jj fields.
- **pipeline-workspace.ts tests**: Mock `ExecGit` verifies correct git command sequences:
  - `createPipelineWorkspace` → calls `git worktree add --detach <path>`
  - `squashPipelineWorkspace` → calls `git add -A`, `git diff --cached HEAD` in worktree, `git apply` in main, `git worktree remove`
  - `cleanupPipelineWorkspace` → calls `git worktree remove --force`
  - `getWorkspaceDiff` → calls `git add -A`, `git diff --cached HEAD --stat`, `git diff --cached HEAD`
- **Error path tests**: git command failures return `{ error }` with descriptive messages. Squash failure preserves worktree for inspection.
- **Integration**: pipeline-runner and pipeline-tool tests use the same mock executor pattern — no filesystem or git repo required.
