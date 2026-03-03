# Brainstorm: Comprehensive VCS Integration

## Approach

Megapowers currently has no automated git branching, committing, or PR workflow despite prompts claiming "version control is managed automatically." The only git usage is ephemeral worktrees for pipeline subagents (`pipeline-workspace.ts`). This feature adds a complete branch-per-issue lifecycle: auto-create a feature/fix branch on issue selection, manage branch switching with WIP commits when changing issues, and squash + push + PR creation in the done phase.

The design follows the project's established pattern of injecting `ExecGit` as a function dependency for testability. A new `vcs/` module contains three files with clear boundaries: low-level git operations, higher-level branch orchestration, and PR creation via `gh` CLI. Integration hooks into existing issue selection (UI) and done-phase checklist code. All VCS operations are best-effort with graceful degradation — nothing blocks the workflow from completing if git operations fail.

The scope is deliberately limited to three capabilities: branch creation on issue start, WIP commit + branch switch on issue change, and squash + push + PR at done. Deferred to future work: structured per-phase commits, session resume with branch detection, and stale branch cleanup.

## Key Decisions

- **Branch on issue selection, not first phase advance.** Simpler, predictable — every artifact from brainstorm onward lands on the feature branch.
- **WIP commit on issue switch (not stash or worktrees).** WIP commits on a named branch are robust, traceable, and cleaned up by squash. Stashes are anonymous and fragile. Worktrees conflict with shared `.megapowers/` state and pi's single-cwd model.
- **Soft-reset squash (not interactive rebase).** `git reset --soft main && git commit` is deterministic and can't produce merge conflicts. Rebase can fail if main diverged.
- **Push only at done, not per-phase.** Avoids pushing incomplete work to remote. Squash + push + PR is one atomic done-phase action.
- **`gh` CLI for PRs (not GitHub REST API).** One shell command handles auth, Enterprise, SSO. If `gh` isn't installed, skip gracefully — branch is still pushed.
- **`--force-with-lease` for push.** Safe force push after squash — protects against overwriting others' work while handling the rewritten history.
- **Graceful degradation everywhere.** No git? No remote? No `gh`? Surface the error, skip the step, let the user handle it manually. VCS never blocks workflow completion.
- **Branch naming:** `feat/<slug>` for features, `fix/<slug>` for bugfixes.
- **`branchName` added to `state.json`** to track current branch per issue.

## Components

### New files
- **`vcs/git-ops.ts`** — Low-level git operations: `createBranch`, `checkoutBranch`, `wipCommit`, `squashOnto`, `pushBranch`. Every function takes injected `ExecGit`. Pure functions, no side effects beyond git.
- **`vcs/branch-manager.ts`** — Orchestration: `ensureBranch(slug, workflow)` generates branch name and creates/checks out; `switchAwayCommit()` does WIP commit + checkout; `squashAndPush(baseBranch)` does soft-reset squash + push.
- **`vcs/pr-creator.ts`** — `createPR(slug, title, body)` shells out to `gh pr create`. Detects `gh` availability first. Generates PR body from spec/plan/verify artifacts. Returns result or `{ skipped, reason }`.

### Modified files
- **`hooks.ts`** or **`ui.ts`** — Issue selection triggers `ensureBranch()`; issue switch triggers `switchAwayCommit()` then `ensureBranch()` for new issue.
- **`ui.ts`** — Done-phase checklist gets "Push & create PR" item (checked by default, skippable).
- **`state/state-io.ts`** — `branchName: string | null` added to state shape.

## Error Handling

- **Branch already exists** → check it out (idempotent, handles session resume).
- **Nothing to commit on switch** → skip WIP commit, just checkout (normal in early phases).
- **Git index locked** → retry once, then surface error.
- **No remote configured** → skip push, tell user "branch is local only."
- **Auth failure on push** → surface git error, user fixes and retries via checklist.
- **Remote branch exists after squash** → `--force-with-lease` handles safely.
- **`gh` not installed** → detect with `gh --version`, skip PR, show install hint.
- **`gh` auth failure** → pass through error message.
- **Not a git repo** → surface error on issue selection, don't silently init.

## Testing Strategy

All tests use injected mock `ExecGit`/`ExecCmd` — no real git repos needed.

- **`git-ops.test.ts`** — Unit tests for each operation: correct git args, handles empty status (nothing to commit), handles errors.
- **`branch-manager.test.ts`** — Orchestration: creates new branch vs checks out existing; WIP commit + switch sequence; branch name generation (`feat/` vs `fix/`); squash + push sequence.
- **`pr-creator.test.ts`** — `gh` detection; correct `gh pr create` args; graceful skip when unavailable; error passthrough.
- **`ui.test.ts`** — Done-phase checklist includes PR item; issue selection calls `ensureBranch`; issue switch calls `switchAwayCommit`.
- **`hooks.test.ts`** — Integration points fire correct VCS calls on issue lifecycle events.

## Out of Scope (deferred)

- Structured per-phase commits (e.g., "brainstorm complete" commit messages)
- Session resume with automatic branch detection/checkout
- Stale branch cleanup / orphaned worktree pruning
- GitLab/Bitbucket support (only GitHub via `gh` for now)
