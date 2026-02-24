---
id: 47
type: bugfix
status: done
created: 2026-02-24T18:55:00.000Z
---

# TDD guard blocks type-only tasks that can't produce a failing test

## Problem

During implement phase, the TDD guard requires writing a test file and getting a RED (failing test) before writing production code. For tasks that are purely type-level changes (e.g., adding a field to an interface, changing a type alias, narrowing a union), there is no meaningful runtime test that can fail first. The agent gets stuck — it can't write the type change because TDD demands RED, but it can't produce RED because the change is compile-time only.

## Reproduction

1. Create a plan with a task like "Add `phase` field to `SubagentStatus` interface"
2. Enter implement phase
3. Agent tries to edit the type definition — blocked by TDD guard
4. Agent writes a test — but type changes don't produce runtime failures, only `tsc` errors
5. Agent loops or gets stuck

## Expected Behavior

The agent should be able to complete type-only tasks without getting stuck. Options:

1. **Plan-level**: The `[no-test]` annotation already exists and bypasses TDD. The LLM prompt during plan phase could be guided to annotate type-only tasks with `[no-test]`.
2. **Runtime**: Recognize `tsc` / type-check failures as a valid RED signal (currently only test runner output like `bun test` counts as RED).
3. **Agent guidance**: Improve implement-phase prompts to tell the agent about `/tdd skip` when a task is type-only.

## Context

- `[no-test]` annotation on plan tasks already bypasses TDD in `canWrite()` — the mechanism exists
- `/tdd skip` slash command exists as an escape hatch
- The prompt injection during implement may not adequately surface these options to the agent
- This was hit in practice using megapowers on a real project (pi-agent fork)
