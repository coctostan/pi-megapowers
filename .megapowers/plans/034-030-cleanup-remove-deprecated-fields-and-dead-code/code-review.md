# Code Review: 034-030-cleanup-remove-deprecated-fields-and-dead-code

## Summary

Pure deletion refactor across 5 production files and 3 test files. No behavior was added or changed. Review focuses on whether deletions were clean, the guard tests added in place of removed tests are meaningful, and whether any cruft was introduced.

---

## Files Reviewed

- `extensions/megapowers/state-machine.ts` — removed `planTasks`, `acceptanceCriteria` fields and `state.planTasks` fallback block
- `extensions/megapowers/satellite.ts` — deleted `loadSatelliteState()` entirely; file now contains only `isSatelliteMode()`
- `extensions/megapowers/store.ts` — removed `loadState`/`saveState` from interface and implementation
- `extensions/megapowers/prompts.ts` — removed `buildPhasePrompt()`
- `extensions/megapowers/task-coordinator.ts` — removed `shouldCreateTaskChange`, `abandonTaskChange`, `squashTaskChanges`, `TaskChangeContext`
- `tests/task-coordinator.test.ts` — removed behavioral test blocks, added dead-exports guard
- `tests/store.test.ts` — removed `describe("state persistence", ...)`, added deprecation guard assertion

---

## Findings

### Critical
None.

### Important
None.

### Minor

**1. Dual import from the same module in `tests/task-coordinator.test.ts` (lines 2–9)**

The test file now has two import statements from `task-coordinator.js`:
```ts
import * as taskCoordinator from "../extensions/megapowers/task-coordinator.js";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
  createTaskChange,
  inspectTaskChange,
} from "../extensions/megapowers/task-coordinator.js";
```
The namespace import (`* as taskCoordinator`) is used only in the `describe("dead exports")` block. The named import handles everything else. The named exports could be accessed via `taskCoordinator.buildTaskChangeDescription(...)` etc., eliminating the duplicate, but that would require touching every test body. Alternatively, the guard block could be rewritten using `Object.keys()` or a type-check trick. As written it is clear and functional — bundlers and module systems deduplicate the import at runtime. No correctness risk, purely a style observation.

**2. Orphaned section comment in `satellite.ts` (line 1)**

```ts
// --- Detection ---
```

With `loadSatelliteState()` gone, this file now has a single exported function and a single interface. The `// --- Detection ---` section marker no longer serves a sectioning purpose (there is only one section). It's harmless but reads oddly in a 20-line file. Could be removed in a follow-up pass.

**3. Pre-existing `mockJJ` duplication in `tests/task-coordinator.test.ts` (lines 91 and 135)**

`mockJJ` is defined identically inside both `describe("createTaskChange")` and `describe("inspectTaskChange")`. This was present before this PR and is out of scope here, but noted for future cleanup (extract to file-level helper).

---

## Assessment

**ready**

The deletions are clean, targeted, and complete. No dead code was left behind, no imports are now dangling in production files, and the test suite passes with 406/406. The two guard tests added (`dead exports` in task-coordinator.test.ts and `does not expose deprecated state persistence methods` in store.test.ts) are meaningful — they assert the contracts established by this refactor and will catch regressions if anyone re-adds the removed symbols. The three minor findings are non-blocking style observations; none introduce risk or confusion significant enough to hold the merge.
