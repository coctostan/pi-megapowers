---
id: 83
type: feature
status: done
created: 2026-02-26T00:00:00.000Z
sources: [64]
milestone: M4
priority: 1
---

# Comprehensive VCS integration (git)

## Problem

Megapowers now runs on pure git (jj removed in #091). Basic VCS is in place (commits on phase transitions, git worktrees for pipeline isolation) but lacks a complete automated workflow. Key gaps:

1. **No automated PR workflow** — pushing branches and opening PRs is still manual
2. **No squash-on-merge support** — workflow commits (brainstorm, spec, plan, verify) create noisy history; should squash to a clean commit before push
3. **No branch management** — feature branches aren't created automatically on issue start; stale branches accumulate
4. **No conflict detection** — no warning when working branch diverges from remote main
5. **No session resume** — if a session dies, the next session doesn't check out the right branch

## Desired Behavior

### Issue start
- Create a `feat/<slug>` or `fix/<slug>` branch on issue selection
- Save `branchName` to state

### During work
- Phase advances commit with structured messages (existing behavior)
- Task completion creates additional commits

### Done phase / `/ship`
- Squash all issue commits into a single clean commit
- Push branch to origin
- Open PR via `gh pr create` (title from issue, body from spec/diagnosis)

### Session resume
- Check out the saved `branchName` on session start
- Warn if branch has diverged from remote

### Cleanup
- Detect and prune stale local branches and orphaned worktrees on session start

## Notes
- Absorbs #064 (git push + PR workflow)
- jj-specific work from the original #083 scope was resolved/removed by #091
