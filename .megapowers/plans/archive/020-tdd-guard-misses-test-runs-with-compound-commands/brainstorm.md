## Approach

Replace the implicit bash command sniffing (`isTestRunnerCommand` + `processBashResult`) with explicit `tests_failed` and `tests_passed` actions on `megapowers_signal`. The LLM runs tests however it wants — compound commands, piped, make targets, whatever — reads the output, and calls the appropriate signal. This aligns with the tool-first architecture established in the 030 refactor where every other state transition already uses explicit tool calls.

The prompt (`implement-task.md`) gets updated to instruct the LLM to always call a signal after running tests: `tests_failed` for RED, `tests_passed` for GREEN. This eliminates conditional logic — "always signal after tests" is simpler than "signal only if they failed."

All bash sniffing machinery is deleted: `isTestRunnerCommand()`, `TEST_RUNNER_PATTERNS[]`, `processBashResult()`, and the satellite inline sniffing in `index.ts`. Net code reduction.

## Key Decisions

- **Include both `tests_failed` and `tests_passed`** — zero-cost, gives the LLM a uniform "always signal" instruction, and `tests_passed` is self-documenting even though it's a no-op on state
- **Delete, don't deprecate** — no fallback sniffing (Option C rejected). Two mechanisms for the same transition creates confusion
- **Satellite gets same treatment** — satellite bash sniffing in `index.ts:~100-106` is removed; satellite sessions use the same signal tool

## Components

- `tool-signal.ts` — add `tests_failed` / `tests_passed` handlers
- `write-policy.ts` — delete `isTestRunnerCommand`, `TEST_RUNNER_PATTERNS`
- `tool-overrides.ts` — delete `processBashResult`
- `index.ts` — remove satellite bash sniffing, update tool schema enum
- `prompts/implement-task.md` — add signal instructions after test runs
- Tests updated accordingly

## Testing Strategy

- Unit tests for new signal actions in `tool-signal.ts` (tests_failed transitions `test-written → impl-allowed`, tests_passed is no-op)
- Verify `handleSignal` rejects `tests_failed` outside implement phase
- Verify `tests_failed` requires `test-written` state (can't skip ahead)
- Remove all `isTestRunnerCommand` and `processBashResult` tests
- Existing `canWrite` tests unchanged (policy layer untouched)
