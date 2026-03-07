# Learnings — 093-vcs-lifecycle-audit-clean-commit-strateg

- **Extracting inline git logic into named exports pays immediately in testability.** `maybeSwitchAwayFromIssue` and `resolveActivationBaseBranch` were previously anonymous `try/catch` blocks inside `handleIssueCommand`. Moving them to exported named functions required zero behavioral changes but unlocked focused unit tests without the full `handleIssueCommand` fixture overhead.

- **A single `git status --porcelain --untracked-files=all --ignored` call captures all four file categories at once** (tracked, safe-untracked, ignored, blocked). Trying to do this with multiple targeted status calls would require more git subprocesses and harder-to-read tests. The porcelain `--ignored` flag is not commonly documented but is the right tool here.

- **Discriminated result unions with a `step` field make pipeline orchestration errors actionable without string-parsing.** `ShipResult` with `step: "validate" | "finalize" | "squash" | "push" | "pr"` means the LLM (or a future UI) can branch on exactly which step failed rather than inspecting error message text. The `pushed: boolean` discriminant on the union variants also prevents confusing a post-push PR failure with a pre-push failure.

- **Explicit `--base` and `--head` in `gh pr create` matters after squash+force-push.** Before the fix, `gh` would infer the base from the remote tracking branch of the current HEAD. After a `git reset --soft <base>` the HEAD state is less predictable, making the implicit inference fragile. Always pass `--base` and `--head` explicitly.

- **Integration tests with a real `git init` / bare `git init --bare` are invaluable for squash flows.** Unit tests with mocked `execGit` prove the call sequence, but only an integration test catches issues like "squash produces zero commits" or "finalization commit was accidentally included in the remote history." One real-git test caught that the `chore: finalize` commit was being squashed away correctly by `git reset --soft`, confirming the full pipeline works end-to-end.

- **`squashBranchToSingleCommit` as an intermediate named step removes a source of confusion.** Previously `squashAndPush` called `squashOnto` and then `pushBranch`. Naming the squash step explicitly (with its own result type `SquashStepResult`) made it easier to write a test that proves only three git calls occur: `reset --soft`, `status --porcelain`, `commit -m`. It also made the error-step labeling unambiguous.

- **Dead code and redundant assertions are easy to introduce when implementing tasks incrementally.** The unreachable comment after `return { ok: true }` in `validateShipTarget` and the duplicate `expect(prAttempted).toBe(false)` assertion in one shipping test both came from copy-paste during multi-step implementation. Code review caught them — a reminder that incremental task-by-task development accumulates small entropy that needs a final review pass.
