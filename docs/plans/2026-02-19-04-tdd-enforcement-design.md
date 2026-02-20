# 04: TDD Enforcement — tdd-guard Design

## Overview

A mechanical enforcer that intercepts file writes during the `implement` phase via `before_tool_call`. It ensures the LLM writes a failing test before writing production code, per task. This is not prompt-based discipline — it's a hard gate.

## State Machine

Per-task state machine tracking the Red-Green cycle:

```
no-test → test-written → test-failing → impl-allowed
```

| State | Meaning | Production writes |
|-------|---------|-------------------|
| `no-test` | Initial state | ❌ Blocked |
| `test-written` | Test file written | ❌ Blocked |
| `test-failing` | Tests run and failed | ✅ Allowed |
| `impl-allowed` | LLM can implement freely | ✅ Allowed |

State resets to `no-test` when the active task changes.

Once a task reaches `impl-allowed`, it stays there for the duration of that task — the guard enforces that the cycle *starts* with a test, not strict per-assertion red-green cycling within a task.

## Interception Logic

On every `before_tool_call` during the `implement` phase:

1. **Not a file write?** Pass through. Bash commands, file reads, etc. are always allowed.

2. **File on the allowlist?** Pass through. Exempt file types:
   - Config: `.json`, `.yaml`, `.yml`, `.toml`, `.env`, `.config.*`
   - Type definitions: `.d.ts`
   - Documentation: `.md`
   - Generated files (configurable patterns)

3. **Current task marked `[no-test]`?** Pass through. No state machine, no blocking.

4. **File is a test file?** Advance state to `test-written`, pass through. Test file detection uses conventions:
   - Files matching `*.test.*` or `*.spec.*`
   - Files in `test/`, `tests/`, or `__tests__/` directories

5. **State is `impl-allowed`?** Pass through.

6. **Block.** Reject the tool call and inject a corrective prompt:
   > "TDD violation: this file write was blocked by tdd-guard because no failing test exists for the current task. Ask the user whether this task needs a test or if it's safe to skip TDD for this file."

### Test Failure Detection

On bash command execution (post-tool): if the command matches a test runner pattern (`bun test`, `npm test`, `pytest`, `jest`, `vitest`, etc.) and exits with a non-zero code while state is `test-written`, advance state to `test-failing` → `impl-allowed`.

## Plan Integration

### `[no-test]` Tag

Tasks in the plan can be annotated with `[no-test]` to skip TDD enforcement entirely:

```markdown
## Tasks
- [ ] Define retry config schema [no-test]
- [ ] Implement retry logic with backoff
- [ ] Add request deduplication
```

The plan parser extracts the `[no-test]` tag into a `noTest: boolean` field on the parsed task object. When tdd-guard checks the current task and `noTest` is true, enforcement is fully bypassed.

### Review Phase Validation

The review phase prompt should instruct the LLM to validate that `[no-test]` annotations are reasonable and justified. Plans should include a brief reason for each exemption.

## Runtime Skip (LLM-Mediated)

For edge cases not anticipated during planning, tdd-guard supports a runtime skip flow:

1. Guard blocks a production file write
2. Corrective prompt tells the LLM to ask the user if TDD should be skipped for this task
3. The LLM asks the user in natural conversation
4. If user approves, the LLM invokes `/tdd skip` to unlock the current task
5. The skip is logged in the task record with an audit trail

The user never needs to know the `/tdd skip` command — the LLM mediates the interaction.

## Dashboard Integration

The dashboard widget shows current tdd-guard state per task:

| Indicator | State | Meaning |
|-----------|-------|---------|
| 🔴 Need test | `no-test` | Production writes blocked |
| 🟡 Run test | `test-written` | Waiting for failing test run |
| 🟢 Implement | `impl-allowed` | Production writes unlocked |
| ⚪ Skipped | `[no-test]` or user skip | TDD bypassed (logged) |
| — | N/A | Not in implement phase |

Skips (both plan-level and runtime) are recorded in the task record and surfaced in the done-phase summary for review.

## Components

### New Module: `tdd-guard.ts`

- `TddState` type and per-task state tracking
- `checkFileWrite(filePath, currentTask, state)` → `{allow, reason, newState}`
- `isTestFile(filePath)` → boolean (convention-based)
- `isAllowlisted(filePath)` → boolean
- `isTestRunnerCommand(command)` → boolean
- `handleTestResult(exitCode, state)` → new state

### Modifications

- **`plan-parser.ts`** — Parse `[no-test]` tag from task lines into `noTest` field
- **`index.ts`** — Wire `before_tool_call` handler; register `/tdd skip` command
- **`ui.ts`** — Add TDD state indicator to dashboard widget
- **`store.ts`** — Persist TDD state per task; record skips in task audit trail

## Non-Goals

- Per-assertion red-green cycling within a task (too granular)
- Auto-running tests on behalf of the LLM (the LLM runs tests itself)
- Bugfix mode regression test enforcement (separate design)
