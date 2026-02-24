# Learning: Derive structural data on demand, don't cache in state

## Context
Issues #006 and #029 showed that caching derived data (task lists, acceptance criteria) in `state.json` creates synchronization bugs. The cached data drifted from the source artifact files.

## Problem
When `planTasks[]` is stored in state AND parsed from `plan.md`:
- Which is authoritative? Depends on when you ask.
- If parsing fails or is skipped (crash, session restart), state has stale data
- If the user edits `plan.md`, state doesn't update
- Extra state fields increase the surface area for serialization bugs

## Solution
Remove `planTasks` and `acceptanceCriteria` from `state.json` entirely. Store only coordination data (`currentTaskIndex`, `completedTasks[]`). Derive task lists from `plan.md` and criteria from `spec.md`/`diagnosis.md` on every access.

## Key insight
**State should store only data that can't be derived.** If it can be parsed from an artifact file, parse it fresh every time. The parse cost is negligible (<1ms for plan files) and eliminates an entire category of consistency bugs.

## Caveat during code review
When migrating to derived data, grep the entire codebase for the old field names. We found `gates.ts` and `ui.ts` still reading `state.planTasks` (always empty after migration) — the dashboard showed 0 tasks and manual phase transitions failed. The fix was mechanical but the bug was invisible until runtime.
