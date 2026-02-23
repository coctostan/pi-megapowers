---
id: 21
type: bugfix
status: done
created: 2026-02-23T14:48:00.000Z
---

# Refactor task completion: source of truth is unreliable

## Problem

The implement phase task list has a fragile source of truth. Task completion depends on the artifact router's regex pattern matching against LLM output text (`/(?:task\s+(?:complete|done|finished)|##?\s*(?:what was implemented|checkpoint))/i`), but this frequently fails to trigger because:

1. **Regex matching is brittle** — the agent's completion message must contain exact phrases like "task complete" or "## What was implemented". Minor wording changes cause silent failures.
2. **In-memory vs file state divergence** — the extension holds state in memory (`state` variable in index.ts) and writes to `.megapowers/state.json`, but these drift apart. Manual fixes to the JSON file are overwritten by the in-memory state on next save.
3. **TDD guard state blocks even after tests fail** — the `tddTaskState` stays at `test-written` despite test failures being detected, because the `handleTestResult` call path doesn't reliably fire for bash tool calls. The guard then blocks all production file writes.
4. **No explicit task completion API** — there's no `/task done` command or programmatic way to mark a task complete. Everything relies on passive regex detection of LLM output, which is inherently unreliable.
5. **Task index advancement fails silently** — when the regex doesn't match, `currentTaskIndex` never advances, leaving the system permanently stuck on the same task with no error or diagnostic.

## Impact

This causes repeated session failures where:
- Tasks are fully implemented (tests written, passing, production code done)
- But the state machine doesn't recognize completion
- Manual state.json edits get overwritten by stale in-memory state
- Users must restart sessions or manually hack state files

## Proposed Fix

1. Add an explicit `/task done` command that marks the current task complete and advances the index. This provides a reliable fallback when regex detection fails.
2. Consider making file state authoritative for task completion (read from disk before each check), rather than relying on in-memory state that can drift.
3. Add diagnostic logging when the artifact router processes implement-phase messages, so silent regex mismatches are visible.
4. Fix the TDD guard's `handleTestResult` integration — ensure bash tool calls running test commands actually trigger the state transition from `test-written` to `impl-allowed`.
