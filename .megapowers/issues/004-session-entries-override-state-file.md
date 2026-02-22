---
title: "Session entries override state.json, making state changes impossible"
type: bugfix
status: done
created: 2026-02-22
related: 003-implement-resume-broken
---

# Session entries override state.json, making state changes impossible

## Bug Description

On every `session_start`, the extension iterates over pi session entries and unconditionally overwrites the in-memory state with the last `megapowers-state` session entry. This means `state.json` (the persisted file) is never authoritative — stale session entries always win. Any manual or programmatic update to `state.json` is silently discarded.

## Steps to Reproduce

1. Complete all 8 implementation tasks (all tests pass, all files exist)
2. Update `.megapowers/state.json` to set `phase: "verify"` with all `planTasks[].completed: true`
3. Start a new pi session
4. Observe: the system prompt still shows `phase: implement` with Task 1 of 8

## Root Cause

In `extensions/megapowers/index.ts`, the `session_start` handler:

```typescript
// Load persisted state
state = store.loadState();  // ← loads state.json correctly

// Also reconstruct from pi session entries (crash recovery)
for (const entry of ctx.sessionManager.getEntries()) {
  if (entry.type === "custom" && (entry as any).customType === "megapowers-state") {
    state = (entry as any).data as MegapowersState;  // ← OVERWRITES state.json
  }
}
```

The session entries loop runs unconditionally and replaces whatever was loaded from `state.json`. Session entries persist across pi sessions, so stale state from a previous session always overrides the file.

## Expected Behavior

`state.json` should be the source of truth. Session entries should only be used for crash recovery when `state.json` has no active issue (indicating the file was never written or was corrupted).

## Fix Applied (partial)

Created `extensions/megapowers/state-recovery.ts` with `resolveStartupState()`:
- If `fileState.activeIssue` exists → use file state (authoritative)
- If no active issue in file → fall back to session entries (crash recovery)

Updated `index.ts` to use `resolveStartupState()` instead of the unconditional loop.

Added 4 tests in `tests/state-recovery.test.ts`.

**Note:** The fix only takes effect on session restart. Any session that loaded the old code before the fix will remain stuck until a fresh session is started with the new code.

## Additional Issue

Even after the `resolveStartupState` fix, a secondary problem exists: when `planTasks` is recovered from `plan.md` via `extractPlanTasks()`, all tasks default to `completed: false` regardless of whether the work was already done. There is no mechanism to detect that a task's implementation already exists. This means recovering from a state loss in the implement phase always resets progress to task 1.

## Files Changed

- `extensions/megapowers/state-recovery.ts` (created)
- `extensions/megapowers/index.ts` (modified)
- `tests/state-recovery.test.ts` (created)

## Test Results

315 pass, 0 fail, 554 expect() calls across 15 files.
