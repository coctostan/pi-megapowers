# Learnings: 083-comprehensive-vcs-integration

- **Wiring production executors in `index.ts` is easy to forget.** All VCS logic used injected `ExecGit`/`ExecCmd` for testability, but the actual `pi.exec`-backed implementations were never placed in `runtimeDeps`. The feature shipped as dead code. Code review caught it — the fix was two initializers in `index.ts`. Lesson: when adding optional fields to `RuntimeDeps`, always immediately add their production initialization in `index.ts` and write an integration smoke test or note in the task that flags this bootstrap step explicitly.

- **`baseBranch` captured from current HEAD is wrong on issue-to-issue switch.** When switching from `feat/001` to `feat/002`, HEAD is the old feature branch, so `baseBranch` was stored as `feat/001` instead of `main`. At done-time `squashOnto` would have squashed onto the wrong branch. The fix: propagate `prevState.baseBranch` on switch instead of capturing from HEAD. Lesson: any state captured "from current environment" needs a regression test that exercises the switch path, not just the fresh-activation path.

- **Injected executor pattern (`ExecGit`/`ExecCmd`) makes VCS modules trivially testable.** No temp repos, no spawned processes — tests are pure in-memory mock functions verifying exact call sequences. This is the right abstraction for any external-process module. The `(cmd, args)` shape for `ExecCmd` vs `(args)` for `ExecGit` is a minor inconsistency worth unifying in future refactors.

- **Structured error returns (`{ ok: false, error, step }`) degrade better than exceptions.** The `step: "squash" | "push"` discriminator on `SquashAndPushResult` let the notification layer say exactly which step failed without re-parsing error strings. The pattern is worth adopting for all multi-step operations where partial failure has different UX meaning.

- **Graceful degradation requires explicit consume-vs-retain semantics for each failure mode.** The push-and-pr handler has three failure cases: (a) no branch tracked → consume action, (b) push fails → retain action for retry, (c) PR fails → consume action. These are intentionally different. Documenting the rationale inline (`// user can retry` vs `// once push succeeds, don't retry`) prevents future authors from accidentally unifying them.

- **Test coverage gaps on secondary paths led to the baseBranch bug.** The AC15 test verified `branchName` after switch but didn't assert `baseBranch`. Adding one extra `expect(state.baseBranch).toBe("main")` assertion in the switch test would have caught the bug before code review. Lesson: for state mutations, assert *all* fields that change, not just the primary one.

- **`gh pr create` without `--base` targets the repo default branch.** This is usually correct but can surprise users on repos with non-default base branches. A follow-up improvement: pass `--base ${baseBranch}` when available to make the PR target explicit.
