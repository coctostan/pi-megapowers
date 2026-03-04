---
id: 87
type: bugfix
status: done
created: 2026-03-04T03:20:43.802Z
priority: 2
milestone: M1
---
# push-and-pr done action fails permanently when not on feature branch
## Problem

The `push-and-pr` done action in `hooks.ts` `onAgentEnd` handler doesn't check out the feature branch before calling `squashAndPush`. When the user is on `main` (e.g., after merging a PR and running `git checkout main && git pull`), the squash is a no-op and the push fails because the local feature branch no longer exists.

Since the handler doesn't consume the action on failure (AC19 retry logic), `push-and-pr` stays as `doneActions[0]` forever, permanently blocking `close-issue` and all subsequent actions.

## Root Cause

`hooks.ts` line 150: `squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg)` assumes we're on the feature branch. No checkout is performed first.

`squashOnto("main", ...)` on main does `git reset --soft main` (no-op, returns ok), then `pushBranch("feat/...", true)` fails with "src refspec does not match any" because no local branch exists.

## Two structural issues

1. **No branch checkout**: handler should either checkout the feature branch or detect that we're already on main with the work merged
2. **Blocking sequential processing**: a stuck done action permanently blocks all subsequent actions — need graceful skip or independent processing

## Reproduction

1. Complete code-review, transition to done
2. Push and create PR (manually or via automation)
3. Merge PR on GitHub
4. Run `git checkout main && git pull` (deletes local feature branch)
5. Start new session — `onAgentEnd` fires, `push-and-pr` fails permanently, `close-issue` never runs
