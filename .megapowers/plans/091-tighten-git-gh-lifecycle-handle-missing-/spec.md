# Spec: Tighten Git/GH Lifecycle

## Goal

Prevent new issues from branching off stale feature branches by adding a programmatic pre-flight check at issue activation time that detects stale branches and syncs with the remote, and improve the done-phase prompt to handle missing/unauthenticated `gh` CLI gracefully and guide the user through post-merge cleanup.

## Acceptance Criteria

1. When activating an issue while on a `feat/*` or `fix/*` branch that is **not** tracked in state (`state.branchName` is null), `handleIssueCommand` silently runs `git checkout main` before proceeding.

2. A new `checkBranchSync(execGit, baseBranch)` helper returns `{ hasRemote: boolean, behind: number, ahead: number }` by comparing the local base branch against its remote tracking ref.

3. `checkBranchSync` returns `{ hasRemote: false, behind: 0, ahead: 0 }` when `git remote` produces no output.

4. `checkBranchSync` returns `{ hasRemote: true, behind: 0, ahead: 0 }` when local and remote refs are identical.

5. `checkBranchSync` returns the correct `behind` count when local is behind `origin/main` (e.g. PR was merged on GitHub).

6. When `git fetch` fails (offline, auth error), `checkBranchSync` returns `{ hasRemote: true, behind: 0, ahead: 0 }` (fail-open — treat as in-sync).

7. When `checkBranchSync` reports `behind > 0`, `handleIssueCommand` prompts the user with two choices: "Pull latest" (recommended) and "Use local as-is".

8. When the user selects "Pull latest", `handleIssueCommand` runs `git pull` on the base branch before creating the new feature branch.

9. When the user selects "Use local as-is", `handleIssueCommand` proceeds without pulling.

10. When `checkBranchSync` reports `behind === 0` or `hasRemote === false`, no user prompt is shown — activation proceeds silently.

11. The done prompt (`done.md`) instructs the LLM to check `which gh` and `gh auth status` before attempting `gh pr create`.

12. The done prompt instructs the LLM to offer the user help setting up `gh` (install or `gh auth login`) if it's missing or unauthenticated, and to skip PR creation if the user declines.

13. The done prompt instructs the LLM to run `git checkout main` before calling `close_issue`.

14. The done prompt instructs the LLM to tell the user what cleanup commands to run after merging the PR (`git pull && git branch -d <branch>`).

## Out of Scope

- Programmatic (non-LLM) PR creation — push/PR stays LLM-driven via the done prompt
- Automatic `git pull` without user consent — always prompt when behind
- Remote branch deletion — only local branch cleanup is guided
- Detecting or closing abandoned/stale PRs on GitHub
- Handling repos with multiple remotes (assumes `origin`)

## Open Questions

None.
