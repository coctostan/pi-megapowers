---
id: 20
type: bugfix
status: open
created: 2026-02-23T14:32:44.000Z
---

# TDD guard fails to detect test runner results when command contains &, |, or ;

## Problem

The TDD guard's `isTestRunnerCommand` function rejects any command containing `&`, `|`, `;`, or `\n` characters via the regex `/[;&|\n]/`. This means common command patterns used by LLMs are silently ignored:

- `cd /path/to/project && bun test` — rejected due to `&&` containing `&`
- `bun test tests/store.test.ts 2>&1` — rejected due to `&` in redirect
- `bun test tests/store.test.ts | tail -30` — rejected due to `|`

When these commands are rejected, the TDD state remains stuck at `test-written` and never transitions to `impl-allowed`, blocking all production file writes. The developer has to know to run the bare command `bun test tests/store.test.ts` without any prefix or piping for the guard to detect it.

## Reproduction

1. Enter implement phase, write a test file (state → `test-written`)
2. Run `cd /project && bun test tests/store.test.ts` via Bash tool
3. Tests fail with exit code 1
4. Check `.megapowers/state.json` — `tddTaskState.state` is still `"test-written"`
5. Attempt to edit production file — blocked with "TDD violation"
6. Run bare `bun test tests/store.test.ts` (no cd, no pipes)
7. Now state transitions to `"impl-allowed"` and production edits work

## Root Cause

In `tdd-guard.ts`, `isTestRunnerCommand`:

```typescript
if (/[;&|\n]/.test(command)) return false;
```

This character-class regex matches individual characters `&`, `|`, `;`, `\n`. The intent was to reject compound/chained commands, but it's too aggressive — it catches:
- `&&` (both `&` characters match individually)
- `2>&1` (the `&` matches)
- `|` pipe (matches directly)

## Expected Behavior

The guard should detect test runner commands even when:
1. Prefixed with `cd ... &&` (common LLM pattern to ensure correct working directory)
2. Using stderr redirects like `2>&1`
3. Piped through `tail`, `head`, `grep` for output filtering

## Suggested Fix

Instead of rejecting all commands with these characters, extract the actual test runner portion:

1. Split on `&&` and check the last segment (the actual command)
2. Strip `2>&1` redirects before matching
3. Optionally allow trailing pipes (the exit code from `bun test | tail` comes from `tail`, not `bun test`, but in practice the pi Bash tool reports the overall command's error status)

Alternatively, match test runner patterns anywhere in the command string rather than requiring the full command to match, but add negative patterns for dangerous constructs like `; rm`.
