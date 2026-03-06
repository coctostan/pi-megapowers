# Feature: Tighten Git/GH Lifecycle (#091)

## Summary

Two improvements to the issue-activation and done-phase lifecycle:

1. **Stale branch guard** — when activating a new issue while Git HEAD is on a `feat/*` or `fix/*` branch that isn't tracked in state (e.g. left over from a closed issue), `handleIssueCommand` silently runs `git checkout main` before creating the new feature branch. This prevents new issues from accidentally branching off old work.

2. **Remote sync check** — on fresh activation (no tracked branch in state), the new `checkBranchSync` helper fetches from origin and compares local vs. remote. If `main` is behind remote (e.g. a PR was merged on GitHub), the user is prompted to pull before the new branch is created. The check fails-open: offline or auth errors are silently ignored.

3. **Done prompt hardening** — the `push-and-pr` action now checks `which gh && gh auth status` before attempting PR creation, offers the user help installing or authenticating `gh` if needed, provides post-merge cleanup instructions, and the `close-issue` action explicitly runs `git checkout main` before resetting state.

## Why

Without these changes, a common workflow failure was:
- User closes issue on branch `feat/old`
- Activates new issue — still on `feat/old`  
- New feature branch `feat/new` is created off `feat/old` instead of `main`
- PR has a mess of unrelated commits

Similarly, users on machines without `gh` installed would hit a silent failure in the done phase when the LLM attempted `gh pr create`.

## Architecture

### New file: `extensions/megapowers/vcs/sync-check.ts`

```
checkBranchSync(execGit, baseBranch) → BranchSyncStatus
  { hasRemote: boolean, behind: number, ahead: number }
```

Follows the same `ExecGit` dependency-injection pattern used by all other VCS helpers. Three phases: remote check → `git fetch origin` → `git rev-list --left-right --count`. Each phase fails-open via catch.

### Modified: `extensions/megapowers/commands.ts`

The `else` branch of the `prevState.branchName` check (fresh activation path) now:
1. Detects stale `feat/*`/`fix/*` branches and checkouts `main`
2. Calls `checkBranchSync` on the resolved base branch
3. If behind: prompts user with "Pull latest / Use local as-is" via `ctx.ui.select`
4. Pulls if user confirms

### Modified: `prompts/done.md`

- `push-and-pr` section restructured into Step 1 / Step 2 / Step 3
- Step 2 checks gh CLI availability with explicit fallback paths
- Post-merge cleanup instructions added
- `close-issue` section adds `git checkout main` as prerequisite

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/vcs/sync-check.ts` | New — `checkBranchSync` helper |
| `extensions/megapowers/commands.ts` | Stale branch + remote sync detection |
| `tests/sync-check.test.ts` | New — 4 unit tests (AC3–AC6) |
| `tests/vcs-commands.test.ts` | +6 integration tests (AC1, AC7–AC10) |
| `prompts/done.md` | gh CLI checks, cleanup guidance, checkout main |

## Test Coverage

- 853 tests pass, 0 fail
- `checkBranchSync`: 4 tests covering no-remote, in-sync, behind, fetch-fail
- `handleIssueCommand` stale branch: 2 tests (stale feat/* → checkout main; already on main → no checkout)
- `handleIssueCommand` sync: 4 tests (behind+pull, behind+skip, in-sync silent, no-remote silent)
