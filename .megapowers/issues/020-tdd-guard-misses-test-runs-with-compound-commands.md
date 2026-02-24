---
id: 20
type: feature
status: done
created: 2026-02-23T14:32:44.000Z
---

# Migrate TDD RED detection from regex command sniffing to tool-first

## Problem

The TDD guard's `test-written → impl-allowed` transition relies on regex-matching the LLM's bash command string to guess whether it ran a test suite. This is the last implicit detection mechanism in the codebase — everything else (phase transitions, task completion, artifact saving) was migrated to explicit tool calls in the 030 refactor.

The regex approach is fragile in multiple ways:

1. **Compound commands rejected** — `cd /path && bun test`, `bun test 2>&1`, `bun test | tail` all fail the `/[;&|\n]/` guard, leaving TDD state stuck at `test-written`
2. **Hardcoded runner list** — only 9 patterns recognized (`bun test`, `npm test`, `pytest`, `cargo test`, etc.). Misses `make test`, `rake test`, `mix test`, project-specific scripts, etc.
3. **Architectural inconsistency** — 030 established tool-first as the design principle. `megapowers_signal({ action: "task_done" })` is tool-first. But the preceding TDD transition (`test-written → impl-allowed`) still sniffs bash commands.

## Current detection map

| TDD Transition | Mechanism | Status |
|---|---|---|
| `no-test → test-written` | `write`/`edit` intercept + `isTestFile(path)` | ✅ Fine — path classification is reliable |
| `test-written → impl-allowed` | Regex on bash command + exit code | ❌ **This issue** |
| `impl-allowed → no-test` (next task) | `megapowers_signal({ action: "task_done" })` | ✅ Tool-first |
| File path: test vs production | `isTestFile()` regex on path | ✅ Fine — structural convention |
| File path: allowlisted | `isAllowlisted()` regex on path | ✅ Fine — structural convention |

File path regex (#4, #5 above) is fine — `write`/`edit` tools provide exact paths with no ambiguity. The problem is exclusively #2: sniffing bash commands to detect test runs.

## Affected code

- `extensions/megapowers/write-policy.ts` — `isTestRunnerCommand()`, `TEST_RUNNER_PATTERNS[]`, compound command rejection regex
- `extensions/megapowers/tool-overrides.ts` — `processBashResult()` calls `isTestRunnerCommand()`
- `extensions/megapowers/index.ts:105` — satellite session duplicates the same sniffing logic inline
- `prompts/implement-task.md` — TDD instructions that don't mention any tool signal for test results

## Design options

### Option A: Add `tests_failed` action to `megapowers_signal` (recommended)

The LLM already calls `megapowers_signal({ action: "task_done" })` after completing a task. Extend the same tool:

```
megapowers_signal({ action: "tests_failed" })   → test-written → impl-allowed
megapowers_signal({ action: "tests_passed" })   → stay at test-written (optional, for clarity)
```

- The LLM runs tests however it wants (compound, piped, make, etc.)
- The LLM reads the output, determines pass/fail
- The LLM calls the signal tool explicitly
- No bash sniffing needed — `isTestRunnerCommand`, `processBashResult`, and `TEST_RUNNER_PATTERNS` are deleted

**Prompt change:** `implement-task.md` adds: "After running tests, call `megapowers_signal({ action: 'tests_failed' })` if they failed (RED) or `megapowers_signal({ action: 'tests_passed' })` if they passed."

**Tradeoff:** Relies on the LLM correctly calling the signal. If it forgets, TDD state is stuck (same failure mode as today, but with a clear fix: the LLM just calls the tool). The prompt can enforce this.

### Option B: Exit-code-only detection (no command classification)

Keep the bash result hook but remove `isTestRunnerCommand` — ANY failed bash command transitions `test-written → impl-allowed`.

- Simple, no regex
- But: `grep -n something file.ts` returning exit 1 would falsely trigger the transition
- Could mitigate by requiring the command to have been run within N seconds of a test file write, but that's still heuristic

**Tradeoff:** Too permissive. Would let random failures unlock production writes.

### Option C: Hybrid — tool-first with fallback sniffing

Add `tests_failed` to `megapowers_signal` (Option A) but keep a simplified `processBashResult` as fallback for LLMs that forget to call the tool. The fallback could be more permissive (no compound command rejection) since it's defense-in-depth.

**Tradeoff:** Two mechanisms for the same transition. Harder to reason about.

## Recommendation

**Option A.** Clean, consistent, no regex. The LLM is already trained to call `megapowers_signal` for task_done — adding `tests_failed` is the same pattern. Delete `isTestRunnerCommand`, `TEST_RUNNER_PATTERNS`, `processBashResult`, and the satellite inline sniffing. Update the implement prompt. Update tests.

## Scope

- Delete: `isTestRunnerCommand()`, `TEST_RUNNER_PATTERNS[]`, `processBashResult()`, satellite bash sniffing
- Modify: `megapowers_signal` handler in `tool-signal.ts` — add `tests_failed`/`tests_passed` actions
- Modify: `megapowers_signal` tool schema in `index.ts` — update action enum
- Modify: `prompts/implement-task.md` — add signal instructions for test results
- Modify: `extensions/megapowers/index.ts` — remove satellite bash sniffing at line 105
- Update: `tests/write-policy.test.ts`, `tests/tool-overrides.test.ts` — remove sniffing tests, add signal tests
