---
id: 93
type: feature
status: done
created: 2026-03-06T15:38:20.230Z
milestone: M3
priority: 2
---
# VCS lifecycle audit — clean commit strategy, pipeline temp-commit, squash-on-done
## Problem

A full audit of git operations revealed several issues with the current VCS lifecycle. The system has inconsistent commit strategies, dead code, a fragile temp-commit pattern, and a done-phase that pushes messy commit history to PRs.

### Issue 1 — Temp-commit pattern in `createPipelineWorkspace` is fragile

To snapshot uncommitted changes into a worktree, `createPipelineWorkspace` does:
1. `git add -A`
2. `git commit --allow-empty -m "temp-pipeline-commit"` (fake identity: `megapowers@local`)
3. `git worktree add --detach <path>`
4. `git reset HEAD~1` (immediately undoes the commit)

**Problems:**
- If anything interrupts between steps 2 and 3, the temp commit is stranded on the branch with a fake author identity
- The fake `megapowers@local` identity is jarring and unprofessional if it ever surfaces in git history
- `git stash` would achieve the same snapshot without touching commit history at all

### Issue 2 — WIP commits accumulate as messy history

`switchAwayCommit` commits with `"WIP: feat/<slug>"` whenever switching issues. These accumulate on the branch as permanent (until squash) history entries. If the done-phase squash is skipped or fails, these go straight to the PR.

### Issue 3 — `squashAndPush` is dead code

`branch-manager.ts` exports `squashAndPush` (soft-reset to base + force-push) but it is **never called**. The `done.md` prompt tells the LLM to run `git push origin <branch>` raw — pushing all WIP commits and temp-pipeline-commits to the PR.

The original design intended squash-on-done. Either:
- Wire `squashAndPush` into the done phase (automated), or  
- Have `done.md` instruct the LLM to squash manually, or  
- Remove `squashAndPush` if the design has intentionally moved away from squashing

### Issue 4 — Pipeline squash leaves changes uncommitted

`squashPipelineWorkspace` copies files from the worktree back to the main working directory via `copyFileSync` / `unlinkSync`, but makes **no git commit**. Changes land as unstaged files. This is fine for ongoing work but means there is no task-level commit granularity, and the next WIP commit will bundle unrelated task work together.

### Issue 5 — `push-and-pr` on main branch fails permanently (known, #087)

When `branchName` is null or equals `main` (e.g. after `close_issue` on main, or when git is not available at activation), the done-phase push-and-pr fails with no recovery path.

### Issue 6 — `gh` CLI errors surface as opaque failures

When `gh` is not installed or not authenticated, the done.md prompt handles it via LLM instructions, not code. There's no structured fallback, and the `createPR` function in `pr-creator.ts` is also not wired into any automatic flow.

## Goals

1. **Replace temp-commit with `git stash`** in `createPipelineWorkspace` — eliminate fragile commit + immediate reset, fake identity, and stranded-commit risk
2. **Wire squash-on-done** — remove WIP commit clutter from PRs; use `squashAndPush` (or equivalent) in the done phase, either automatically or via clear LLM instruction in `done.md`
3. **Decide on WIP commit strategy** — either keep WIP commits (document they will be squashed), replace with stash, or make configurable
4. **Guard against `branchName === null` in done phase** — detect and warn early, not at push time
5. **Structured `gh` fallback** — clear, early detection of missing/unauthenticated `gh` with a user-friendly message before attempting `gh pr create`
6. **Remove or activate `squashAndPush`** — no orphaned exports

## Acceptance Criteria

- [ ] Pipeline workspace creation uses `git stash` / `git stash pop` instead of temp-commit + reset; no fake author identity ever touches git history
- [ ] `createPipelineWorkspace` handles the case where there is nothing to stash (clean tree) without error
- [ ] The done phase (via prompt or automation) squashes WIP commits into a single clean commit before pushing
- [ ] PRs created by the system have clean, single-commit history (or a squash is clearly documented as the LLM's responsibility)
- [ ] `squashAndPush` is either wired up and called, or removed — not orphaned
- [ ] If `branchName` is null or equals base branch at done-phase entry, the system emits a clear warning (not a silent push failure)
- [ ] `gh` availability check happens before any PR creation attempt; fallback message is shown to user with manual PR URL
- [ ] All new/changed code has corresponding tests
- [ ] Existing VCS tests (`branch-manager.test.ts`, `git-ops.test.ts`, `pipeline-workspace.test.ts`, `vcs-commands.test.ts`, `pr-creator.test.ts`) continue to pass

## Files in Scope

- `extensions/megapowers/vcs/git-ops.ts`
- `extensions/megapowers/vcs/branch-manager.ts`
- `extensions/megapowers/vcs/pr-creator.ts`
- `extensions/megapowers/subagent/pipeline-workspace.ts`
- `extensions/megapowers/prompts/done.md` (or equivalent template)
- `extensions/megapowers/prompt-inject.ts`
- `tests/git-ops.test.ts`
- `tests/branch-manager.test.ts`
- `tests/pipeline-workspace.test.ts`
- `tests/pr-creator.test.ts`
- `tests/vcs-commands.test.ts`

