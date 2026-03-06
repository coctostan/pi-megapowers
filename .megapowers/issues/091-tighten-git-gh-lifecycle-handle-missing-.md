---
id: 91
type: feature
status: in-progress
created: 2026-03-05T21:11:31.873Z
milestone: M3
priority: 2
---
# Tighten git/gh lifecycle — handle missing gh, stale local branches, and unclosed PRs
The git and gh process needs tightening. We now create a feature branch on issue activation and clean up on done, but several gaps remain:

1. **New repos without `gh`** — If `gh` CLI isn't installed or authenticated, the push-and-pr done action fails silently or errors out. Need graceful detection and fallback (e.g. push-only, manual PR instructions, or skip entirely with a clear message).

2. **Stale local branches** — After a PR is merged on GitHub, the local feature branch often lingers. The done-phase cleanup (`git branch -d`) sometimes fails due to unmerged commits (done-phase artifacts committed after the PR merge). Need a reliable cleanup strategy — force-delete after confirming merge, or rebase done-phase commits onto main first.

3. **Unclosed PRs** — If a PR is created but never merged (abandoned issue, reworked approach, etc.), there's no mechanism to close the PR or clean up the remote branch. Need a way to handle abandoned work — close PR, delete remote branch, or at minimum surface stale PRs.

Related: the current done-phase `push-and-pr` action also fails permanently if already on `main` (no feature branch) — see #087.
