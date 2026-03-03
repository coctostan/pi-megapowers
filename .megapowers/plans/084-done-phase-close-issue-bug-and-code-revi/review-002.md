---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 5
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
needs_revision_tasks:
  - 5
---

## Per-Task Assessment

### Task 1: Add doneChecklistShown to MegapowersState schema — ✅ PASS
Correct schema additions to MegapowersState, createInitialState(), transition(), and KNOWN_KEYS. All 5 TDD steps present with full code. Minor: Step 2's expected error message references a TypeScript type error, but bun test doesn't type-check — runtime error would be `Expected: false, Received: undefined`. Cosmetic only.

### Task 2: showDoneChecklist auto-populates defaults in headless mode — ✅ PASS
Correct #081 fix. Tests both feature and bugfix variants. Implementation matches actual `getDoneChecklistItems` output (5 items for feature, swaps generate-docs for generate-bugfix-summary in bugfix). All 5 TDD steps present.

### Task 3: Remove showDoneChecklist from register-tools.ts execute() — ✅ PASS
Source-level assertion appropriate for this refactor. Correctly identifies import (line 7) and AC11 block (lines 47-54). Notes readState import must remain. All 5 TDD steps present.

### Task 4: Defer showDoneChecklist to onAgentEnd in hooks.ts — ✅ PASS
Guard condition is correct. Three new tests cover TUI path, re-show prevention, and headless path. Mock pattern for `ctx.ui.custom` is consistent with existing ui.test.ts tests. Correctly handles existing test replacement. All 5 TDD steps present.

### Task 5: End-to-end headless regression test — ❌ REVISE
Two issues:
1. **TDD flow invalid**: Task depends on [2, 4] which are already implemented. Test passes immediately on write — no RED phase. Should be `no_test: true`.
2. **`setupIssue` helper uses `require("node:fs")`** instead of ES imports. Should add `writeFileSync` to the existing import and use it directly.

### Task 6: Update reproduction tests — ✅ PASS
No-test justification valid. All three replacements correct and consistent with Tasks 2-4.

### Missing Coverage
None — all "Fixed When" criteria are covered.

Revise instructions written to `revise-instructions-2.md`.
