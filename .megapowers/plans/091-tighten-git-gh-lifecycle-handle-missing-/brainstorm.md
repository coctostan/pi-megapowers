# Brainstorm: Tighten Git/GH Lifecycle

## Approach

The core problem is a stale-base bug: after an issue's done phase pushes a branch and creates a PR, `close_issue` resets state but leaves the user on the old feature branch. When the next issue is activated, `handleIssueCommand` captures that dead branch as `baseBranch` and creates the new feature branch from it — missing any work merged into remote main via the PR.

The fix has two parts. First, a **programmatic pre-flight check** in `handleIssueCommand` that runs before creating a new feature branch. It detects stale feature branches (on `feat/*`/`fix/*` with no state tracking it), silently checks out main, then fetches the remote and compares local vs origin/main. If behind, it prompts the user: "Pull latest" (recommended) or "Use local as-is". If there's no remote, it skips the sync check entirely — local main is authoritative. This runs at exactly the right moment (when starting new work, not finishing old work) and catches all edge cases regardless of how the previous session ended.

Second, **done prompt improvements** to `done.md`. The `push-and-pr` section gets better `gh` CLI handling: check `which gh` and `gh auth status` before attempting PR creation, offer to help the user install or authenticate if missing, and gracefully fall back to "just push, create PR manually" if they decline. The prompt also adds guidance to checkout main before `close_issue`, and tells the user what cleanup commands to run after merging the PR on GitHub.

## Key Decisions

- **LLM-driven push/PR stays** — the existing bash-in-prompt approach works well, just needs better guidance for edge cases
- **Programmatic pre-flight for branch sync** — this is deterministic and catches all edge cases (session crash, skipped done actions, etc.) unlike a prompt-only approach
- **User prompt when behind remote** — don't auto-pull; the user may not have merged the PR yet or may intentionally want local state
- **Silent stale branch checkout** — if on an untracked `feat/*`/`fix/*` branch with no state, checkout main without asking (this is always a leftover from a previous closed issue)
- **No remote = no sync check** — local main is authoritative when there's no remote; only handle stale branch detection
- **`gh` setup offered, not required** — if user doesn't want to install/auth gh, skip PR creation and tell them to do it manually on GitHub

## Components

1. **Pre-flight check in `handleIssueCommand`** (`commands.ts`)
   - Detect stale feature branch → `git checkout main`
   - `git remote` → if remote exists, `git fetch origin`
   - Compare `main` vs `origin/main` → if behind, prompt user via `pi.select()`
   - Then capture `baseBranch` and proceed to `ensureBranch`

2. **Helper function** (likely in `vcs/git-ops.ts` or `vcs/branch-manager.ts`)
   - `checkBranchSync(execGit)` → returns `{ hasRemote, behind, ahead }` or similar
   - Pure function, injectable `execGit` for testability

3. **Done prompt update** (`prompts/done.md`)
   - `gh` pre-check: `which gh` + `gh auth status`, offer setup if missing
   - Checkout main before `close_issue`
   - Post-merge cleanup guidance for the user

## Testing Strategy

- **Unit tests for `checkBranchSync`** — inject mock `execGit` returning various scenarios: no remote, behind, in sync, ahead, fetch failure. Verify correct return values.
- **Unit tests for stale branch detection** — mock current branch as `feat/old-issue` with no state `branchName`, verify it triggers checkout main.
- **Integration-style tests for `handleIssueCommand` pre-flight** — mock `execGit` + `pi.select()`, verify the full flow: stale detection → sync check → user prompt → branch creation with correct base.
- **Prompt tests** — verify `done.md` template contains the expected `gh` check instructions and cleanup guidance (string matching on template content).
- **Edge cases** — offline (fetch fails), no remote configured, already on main, ahead of remote, user selects "use local".
