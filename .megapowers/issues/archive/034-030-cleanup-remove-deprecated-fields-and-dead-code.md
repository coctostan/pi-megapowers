---
id: 34
type: feature
status: done
created: 2026-02-23T22:40:18.000Z
sources: [30]
---

# 030 cleanup — remove deprecated fields and dead code

Issue 030 (state source of truth refactor) left Phase 3 cleanup incomplete. The core architecture is correct (disk-first, tool-first, thin schema), but several deprecated/dead artifacts remain that should be removed for hygiene.

## Items

### 1. Remove deprecated `planTasks?` and `acceptanceCriteria?` from `MegapowersState`

**File:** `extensions/megapowers/state-machine.ts`

Lines 58-60 still declare the deprecated optional fields. Lines 158-160 in `transition()` have fallback logic that reads `state.planTasks` — this is dead code since `readState()` strips these keys.

**Action:** Delete the two interface fields and the fallback logic in `transition()`.

### 2. Remove `loadState()` / `saveState()` from `Store` interface

**File:** `extensions/megapowers/store.ts`

The `Store` interface (lines 21-22) and implementation (lines 132-151) still expose `loadState()` and `saveState()`. These are superseded by `readState()` / `writeState()` from `state-io.ts`.

One remaining caller: `satellite.ts:28` uses `store.loadState()` — migrate it to `readState(cwd)` first.

**Action:** Migrate `satellite.ts`, then delete `loadState`/`saveState` from store.

### 3. Remove `tests/task-coordinator.test.ts`

**File:** `tests/task-coordinator.test.ts`

The plan called for deleting this, but `task-coordinator.ts` is still actively imported by `tool-signal.ts` for jj task change management. The module should stay, but confirm the test file is still valid and exercised, or remove it if it tests deleted interfaces.

**Action:** Audit whether `task-coordinator.test.ts` tests current code. Keep if valid, delete if stale.

### 4. Audit dead code in `satellite.ts` and `store.ts`

The done.md from 030 noted dead code: `satellite.ts:loadSatelliteState` and `store.ts` planTasks backfill logic.

**Action:** Remove any confirmed dead code paths.
