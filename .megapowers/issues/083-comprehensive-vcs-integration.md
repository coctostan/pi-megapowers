---
id: 83
type: feature
status: open
created: 2026-02-26T00:00:00.000Z
sources: [64]
milestone: M4
priority: 1
---

# Comprehensive VCS integration (git + jj)

## Problem

Megapowers has basic jj support (bookmark creation, commit on phase transitions) but lacks comprehensive VCS integration. Key gaps:

1. **No automated PR workflow** — pushing branches and opening PRs is manual
2. **No squash-on-merge support** — workflow commits (brainstorm, spec, plan, review, verify) create noisy history; should squash to clean commits before push
3. **No git-only fallback** — projects without jj installed can't use any VCS features
4. **No branch cleanup** — stale bookmarks and orphaned commits accumulate
5. **No conflict detection** — no warning when working copy diverges from pushed branch
6. **No root change tracked** — can't squash the full issue tree (from #064)
7. **No session resume** — if a session dies, next session doesn't navigate back to the right jj change (from #064)

## Desired Behavior

### Issue start
- Create root jj change and bookmark on issue selection
- Save `rootChangeId` to state (never overwritten during issue lifecycle)

### During work
- Phase advances create child changes (existing behavior)
- Task completion creates sibling changes (existing behavior)

### Done phase / `/ship`
- Squash all descendants into `rootChangeId`
- Push bookmark via `jj git push`
- Optionally open PR via `gh pr create`

### Session resume
- Restore working copy to saved `jjChangeId` on session start
- Fall back to `rootChangeId` if change was abandoned

### Cleanup
- Detect and clean up stale workspaces and orphaned commits on session start
- Warn when bookmark diverges from remote

## Notes
- Absorbs #064 (jj bookmark + git push workflow)
- Originally filed as #063 on a branch lost during #070 directory restructure. Recreated with updated context.
