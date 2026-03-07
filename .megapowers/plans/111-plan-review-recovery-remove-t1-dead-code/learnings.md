# Learnings — #111: Remove T1 Dead Code

- **Intentional deferral creates real debt.** Commit `0ec65b9` explicitly noted it was leaving the T1 files for a follow-up issue. That follow-up took multiple issues (#101, batched into #111) to actually land. Deferred dead code should be tagged with a TODO comment referencing the tracking issue so it's findable without archaeology.

- **Phantom test parameters are silent — and that's the problem.** The `handlePlanDraftDone(cwd, failFn)` call with `as any` produced zero runtime errors and a passing test, while testing absolutely nothing. TypeScript's type system would have caught the extra argument without the cast. Treat `as any` in test files as a code smell requiring justification.

- **Structural regression tests ("this file must not exist") are a valid and underrated pattern.** The replacement tests that `readFileSync` and expect it to throw provide a hard guarantee that the dead files don't creep back in. Standard linters and imports won't catch re-introduction of deleted-but-unreferenced files.

- **Dead code that passes tests is more dangerous than dead code that fails tests.** The 8 `plan-lint-model.test.ts` tests all passed, giving false confidence. The orphaned block also passed. Nothing in CI signaled "this is dead" — only a manual grep audit found it.

- **Batch issues work well for mechanical cleanup tasks.** Batching #101 into #111 kept the cleanup scoped and prevented separate PRs for closely related deletions. Good pattern for "do the deferred work from issue N" tasks.

- **Zero-callers grep is the authoritative dead-code check.** `grep -rn "from.*plan-lint-model"` across all source files returned empty — that's the only reliable confirmation of zero callers. TypeScript's `tsc --noUnusedLocals` wouldn't help here since the files aren't imported anywhere to analyze.
