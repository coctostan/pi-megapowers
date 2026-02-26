---
id: 83
type: feature
status: open
created: 2026-02-26T00:00:00.000Z
milestone: M4
priority: 2
---

# Comprehensive VCS integration (git + jj)

## Problem

Megapowers has basic jj support (bookmark creation, commit on phase transitions) but lacks comprehensive VCS integration. Key gaps:

1. **No automated PR workflow** — pushing branches and opening PRs is manual
2. **No squash-on-merge support** — workflow commits (brainstorm, spec, plan, review, verify) create noisy history; should squash to clean commits before push
3. **No git-only fallback** — projects without jj installed can't use any VCS features
4. **No branch cleanup** — stale bookmarks and orphaned commits accumulate (see #070 cleanup experience)
5. **No conflict detection** — no warning when working copy diverges from pushed branch

## Desired Behavior

- `/ship` or done-phase hook automatically squashes workflow commits, creates bookmark, pushes, and opens PR
- Detect git-only vs jj+git and adapt accordingly
- Clean up stale workspaces and orphaned commits on session start
- Warn when bookmark diverges from remote after local changes

## Notes

This was originally filed as #063 on a branch that was lost during the #070 directory restructure cleanup. Recreated here with updated context from that experience.
