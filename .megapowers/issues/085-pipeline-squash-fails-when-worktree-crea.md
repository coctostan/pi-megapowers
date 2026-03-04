---
id: 85
type: bugfix
status: open
created: 2026-03-03T19:52:16.274Z
milestone: M2
priority: 1
---
# Pipeline squash fails when worktree creates files that already exist in main working directory
## Bug

`squashPipelineWorkspace` uses `git diff --cached HEAD | git apply` to bring worktree changes back to the main working directory. This fails when the patch contains "new file" entries for files that already exist in the main WD.

## Repro

1. Task 1 pipeline creates `git-ops.ts` and `git-ops.test.ts` → squashed to main WD (uncommitted)
2. Task 2 pipeline starts → worktree created at HEAD (which doesn't have those files)
3. Subagent creates same files in worktree
4. `git diff --cached HEAD` shows them as `new file mode 100644`
5. `git apply` in main WD fails: `error: extensions/megapowers/vcs/git-ops.ts: already exists in working directory`

## Root cause

The worktree is created at HEAD via `git worktree add --detach`. Files that exist in the main WD as uncommitted additions don't exist at HEAD, so the worktree doesn't have them. When the subagent creates those files and we diff against HEAD, they appear as new files. `git apply` refuses to create files that already exist.

## Fix

Replace `git diff | git apply` with direct file-level copy:
1. `git diff --cached HEAD --name-only --diff-filter=AMCR` → copy from worktree to main WD
2. `git diff --cached HEAD --name-only --diff-filter=D` → delete from main WD
3. Remove worktree

This handles new/modified/deleted files uniformly and can't fail on "already exists."
