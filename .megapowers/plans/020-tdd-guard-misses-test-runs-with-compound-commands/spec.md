## Goal

Replace the TDD guard's implicit bash command sniffing with explicit LLM-driven `tests_failed` and `tests_passed` signal actions, so that compound bash commands (`cd foo && bun test`, `bun test | tail`, etc.) correctly advance TDD state instead of being silently ignored.

## Acceptance Criteria

1. `megapowers_signal({ action: "tests_failed" })` transitions `tddTaskState` from `test-written` to `impl-allowed` during the implement phase.
2. `megapowers_signal({ action: "tests_failed" })` returns an error when called outside the implement phase.
3. `megapowers_signal({ action: "tests_failed" })` returns an error when `tddTaskState` is not `test-written` (e.g. `red-pending` or `impl-allowed`).
4. `megapowers_signal({ action: "tests_passed" })` is accepted during the implement phase and does not change `tddTaskState`.
5. `megapowers_signal({ action: "tests_passed" })` returns an error when called outside the implement phase.
6. The `megapowers_signal` tool schema's action enum includes `tests_failed` and `tests_passed`.
7. `isTestRunnerCommand()` and `TEST_RUNNER_PATTERNS` are removed from `write-policy.ts`.
8. `processBashResult()` is removed from `tool-overrides.ts`.
9. The satellite bash sniffing block in `index.ts` (inline `isTestRunnerCommand` check on bash tool_result) is removed.
10. The satellite uses the same `megapowers_signal` tool for `tests_failed`/`tests_passed` instead of inline bash sniffing.
11. The implement-task prompt instructs the LLM to call `megapowers_signal({ action: "tests_failed" })` after observing test failures and `megapowers_signal({ action: "tests_passed" })` after observing test passes.
12. All existing tests pass after the changes (no regressions outside deleted sniffing tests).

## Out of Scope

- Changing the `canWrite()` write-policy logic (policy layer is untouched).
- Auto-detecting test results from bash output (that's the sniffing we're removing).
- Changes to `task_done`, `review_approve`, or `phase_next` signal behavior.
- TDD guard in-memory vs disk state sync (that's issue #021).

## Open Questions

None.
