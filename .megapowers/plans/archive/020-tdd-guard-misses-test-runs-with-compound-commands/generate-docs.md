# TDD RED Detection: Explicit Signal Model

**Issue:** #020  
**Status:** Shipped

## Overview

TDD RED detection (`test-written → impl-allowed` state transition) is now explicit: after running tests and observing failures, the LLM calls `megapowers_signal({ action: "tests_failed" })`. This replaces implicit bash command sniffing that broke on compound commands.

## Background

Prior to this change, the TDD guard watched bash commands via `isTestRunnerCommand()` + `processBashResult()`. If the command matched a known runner pattern and exited non-zero, the guard advanced to `impl-allowed`. This failed for:

- **Compound commands**: `cd /path && bun test`, `bun test | tee out.txt`, `npm test; echo done`
- **Custom runners**: `make test`, project-specific scripts, any runner not in the hardcoded list
- **Any bash wrapper**: The compound-command guard (`/[;&|\n]/`) rejected them all

## New Behavior

After writing a failing test, the LLM:

1. Runs tests using any command it chooses
2. Reads the output and confirms failures
3. Calls `megapowers_signal({ action: "tests_failed" })` → transitions to `impl-allowed`
4. Writes production code
5. Runs tests again to confirm they pass
6. Calls `megapowers_signal({ action: "tests_passed" })` → acknowledgment (no state change)

## Signal Reference

### `tests_failed`

Transitions `tddTaskState` from `test-written` to `impl-allowed`, unlocking production code writes.

**Valid phases:** `implement`, `code-review`

**Preconditions:** `tddTaskState.state === "test-written"` (a test file must have been written first)

**Returns:**
- Success: `"Tests failed (RED ✓). Production code writes are now allowed."`
- Error if wrong phase or wrong TDD state

### `tests_passed`

Acknowledges GREEN phase. No state mutation — exists for symmetry and LLM instruction clarity.

**Valid phases:** `implement`, `code-review`

**Returns:**
- Success: `"Tests passed (GREEN ✓)."`
- Error if wrong phase

## Removed Machinery

The following are fully deleted:

| Symbol | File | Replaced by |
|--------|------|-------------|
| `TEST_RUNNER_PATTERNS` | `write-policy.ts` | — |
| `isTestRunnerCommand()` | `write-policy.ts` | — |
| `processBashResult()` | `tool-overrides.ts` | `tests_failed` signal |
| Satellite bash sniffing block | `index.ts` | Satellite `megapowers_signal` tool |

## Satellite Mode

Satellite sessions (subagents) also receive a `megapowers_signal` tool, registered in the satellite setup block in `index.ts`. It handles `tests_failed` and `tests_passed` using in-memory `satelliteTddState` (disk state is managed by the primary session).

## Files Changed

- `extensions/megapowers/tool-signal.ts` — `handleTestsFailed()` + `handleTestsPassed()` functions
- `extensions/megapowers/write-policy.ts` — deleted `isTestRunnerCommand` + `TEST_RUNNER_PATTERNS`
- `extensions/megapowers/tool-overrides.ts` — deleted `processBashResult` + updated comment/re-exports
- `extensions/megapowers/index.ts` — updated tool schema enum + registered satellite `megapowers_signal` + removed bash sniffing
- `prompts/implement-task.md` — TDD section now instructs `tests_failed`/`tests_passed` signals

## Testing

New tests in `tests/tool-signal.test.ts`:
- `tests_failed` transitions `test-written → impl-allowed` in `implement` and `code-review`
- `tests_failed` rejects wrong phase, wrong TDD state (null, `red-pending`, `impl-allowed`)
- `tests_passed` accepted in `implement` and `code-review`, no state mutation
- `tests_passed` rejects wrong phase
- Tool schema includes both new action literals (verified via source inspection)
- Satellite sniffing removed (verified via source inspection)
- `processBashResult` + `isTestRunnerCommand` not exported (verified via dynamic import)
