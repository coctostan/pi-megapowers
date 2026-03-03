# Spec: Comprehensive VCS Integration

## Goal

Add automated git branch-per-issue lifecycle management to megapowers: create a `feat/<slug>` or `fix/<slug>` branch when an issue is activated, perform WIP commits and branch switching when changing active issues, and squash + push + PR creation (via `gh` CLI) when an issue reaches the done phase. All VCS operations degrade gracefully — they never block the workflow from completing.

## Acceptance Criteria

1. A new `vcs/git-ops.ts` module exports low-level git functions (`createBranch`, `checkoutBranch`, `wipCommit`, `squashOnto`, `pushBranch`) that each accept an injected `ExecGit` function and return structured results.

2. `createBranch(execGit, branchName, baseBranch)` runs `git checkout -b <branchName>` from the given base branch and returns `{ ok: true }` or `{ ok: false, error: string }`.

3. `checkoutBranch(execGit, branchName)` runs `git checkout <branchName>` and returns `{ ok: true }` or `{ ok: false, error: string }`.

4. `wipCommit(execGit, message)` stages all changes with `git add -A`, checks `git status --porcelain` for uncommitted changes, and commits with the given message. Returns `{ ok: true, committed: boolean }` — `committed` is `false` when there is nothing to commit (clean working tree).

5. `squashOnto(execGit, baseBranch, commitMessage)` performs `git reset --soft <baseBranch>` followed by `git commit -m <commitMessage>` and returns `{ ok: true }` or `{ ok: false, error: string }`. If there is nothing to commit after the reset, it returns `{ ok: true, committed: false }`.

6. `pushBranch(execGit, branchName, force)` runs `git push origin <branchName>` (with `--force-with-lease` when `force` is true) and returns `{ ok: true }` or `{ ok: false, error: string }`.

7. A new `vcs/branch-manager.ts` module exports higher-level orchestration functions (`ensureBranch`, `switchAwayCommit`, `squashAndPush`) that compose git-ops and return structured results.

8. `ensureBranch(execGit, slug, workflow)` generates a branch name (`feat/<slug>` for feature, `fix/<slug>` for bugfix), checks if the branch already exists (via `git rev-parse --verify`), creates it from the current branch if not, and checks it out if it does. Returns `{ branchName: string } | { error: string }`.

9. `switchAwayCommit(execGit, currentBranch)` performs a WIP commit on the current branch (message: `WIP: <currentBranch>`) and returns the WIP commit result. Skips the commit if the working tree is clean.

10. `squashAndPush(execGit, branchName, baseBranch, commitMessage)` calls `squashOnto` then `pushBranch` with `force: true`. Returns `{ ok: true }` or `{ ok: false, error: string, step: "squash" | "push" }`.

11. A new `vcs/pr-creator.ts` module exports a `createPR` function that shells out to `gh pr create`.

12. `createPR(execCmd, branchName, title, body)` first checks `gh` availability (via `gh --version`). If `gh` is not installed, returns `{ skipped: true, reason: "gh CLI not installed" }`. Otherwise runs `gh pr create --title <title> --body <body> --head <branchName>` and returns `{ ok: true, url: string }` or `{ ok: false, error: string }`.

13. `branchName` field (type `string | null`) is added to `MegapowersState` and persisted in `state.json`. It is included in the `KNOWN_KEYS` set in `state-io.ts`. Default value is `null`.

14. When an issue is activated via `/issue list` or `/issue new` (in `ui.ts`), `ensureBranch` is called with the issue slug and workflow type. The returned `branchName` is saved to `state.json`.

15. When a different issue is activated while one is already active (issue switch), `switchAwayCommit` is called with the current `branchName` from state before activating the new issue's branch.

16. If `ensureBranch` or `switchAwayCommit` fails, the error is surfaced via `ctx.ui.notify` with severity `"error"`, and the workflow continues normally (issue activation is not blocked).

17. The done-phase checklist (`getDoneChecklistItems` in `ui.ts`) includes a "Push & create PR" item with key `"push-and-pr"` that is checked by default.

18. When the `"push-and-pr"` done action is processed (in `hooks.ts` `onAgentEnd`), it calls `squashAndPush` followed by `createPR`. The PR title is derived from the issue title and the PR body summarizes the issue.

19. If squash or push fails during the `"push-and-pr"` action, the error is surfaced via `ctx.ui.notify` and the action remains in `doneActions` (not consumed) so the user can retry.

20. If the `"push-and-pr"` action succeeds but PR creation is skipped (no `gh`), a notification informs the user the branch was pushed but PR creation was skipped.

21. If no git repository is detected (e.g., `git rev-parse --git-dir` fails), `ensureBranch` returns an error and the notification tells the user VCS features are unavailable.

22. All functions in `git-ops.ts`, `branch-manager.ts`, and `pr-creator.ts` are tested with injected mock `ExecGit`/`ExecCmd` — no real git repositories are used in tests.

23. `git-ops.ts` functions propagate errors from the injected `ExecGit` as structured `{ ok: false, error }` results rather than throwing exceptions.

## Out of Scope

- Structured per-phase commits (e.g., auto-commit "brainstorm complete" on phase advance)
- Session resume with automatic branch detection/checkout from existing branches
- Stale branch cleanup or orphaned worktree pruning
- GitLab, Bitbucket, or other non-GitHub hosting providers
- Configurable base branch (always uses current branch at time of issue activation)
- Merge conflict resolution
- Remote branch tracking or upstream configuration

## Open Questions

*(None — ready to advance to planning.)*
