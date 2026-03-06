---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 10
  - 12
  - 9
  - 11
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 10
  - 12
needs_revision_tasks:
  - 9
  - 11
---

## Per-Task Assessment

### Task 1: Create LintResult type and lintTask with title validation — ✅ PASS
All 5 TDD steps present with correct, concrete code. Tests cover valid task, empty title, whitespace-only title, and error aggregation. Implementation uses correct `PlanTask` type from `plan-schemas.ts`.

### Task 2: Add description minimum length check — ✅ PASS
Clean boundary testing (short, exact 200, >200). Introduces `LintTaskInput` type extending PlanTask with description. Migration note for existing tests is appropriate.

### Task 3: Add depends_on validation — ✅ PASS
Tests cover forward reference, non-existent task, self-reference, and valid case. Implementation logic correctly separates the >= check (AC5) from the existence check (AC4).

### Task 4: Add duplicate files_to_create check — ✅ PASS
Tests cover overlap, no-overlap, and self-update (same task ID shouldn't conflict). Implementation correctly skips self during updates.

### Task 5: Integrate lintTask into handlePlanTask — ✅ PASS
Integration points are correct for both create and update paths. Tests verify lint blocks saves on failure and allows valid tasks. Uses correct `listPlanTasks` API.

### Task 6: Create plan-lint-model module — ✅ PASS
Good test coverage: pass, fail, malformed (fail-open), API error (fail-open). `CompleteFn` injection pattern is clean. `ModelLintResult` type correctly handles warning on pass.

### Task 7: Create lint-plan-prompt.md template — ✅ PASS
Valid [no-test]. Template has correct `{{spec_content}}` and `{{tasks_content}}` placeholders matching `interpolatePrompt` usage.

### Task 8: Verify T1 prompt assembly — ✅ PASS
Tests verify spec content, task titles/descriptions/files, and template keywords are present in assembled prompt. `loadPromptFile` resolves relative to `prompts.ts` location, so it finds the template correctly.

### Task 9: Make handlePlanDraftDone async — ❌ REVISE
**Critical:** Removing `plan_draft_done` from `handleSignal`'s switch breaks ~10 existing tests in `tests/tool-signal.test.ts` (lines 266-331, 824) that call `handleSignal(tmp, "plan_draft_done")`. Step 3 vaguely says "Update existing tests" but provides no migration code. Must include explicit code showing: (1) import changes, (2) sync→async migration pattern, (3) the specific test cases affected. See revise-instructions-3.md for details.

### Task 10: Add graceful degradation for unavailable API key — ✅ PASS
Logic is correct. Tests verify warning message for both missing completeFn and malformed model response. Step 3 shows the full function which duplicates Task 9 but is self-contained enough.

### Task 11: Wire async handlePlanDraftDone in register-tools.ts — ❌ REVISE
String-matching tests are acceptable for wiring code but over-constrained: the negative assertions (`not.toContain("completeSimple")`, `not.toContain("?? ctx.model")`) are fragile and test implementation details rather than behavior. Also, `buildLintCompleteFn` uses `ctx: any` — should be typed. See revise-instructions-3.md.

### Task 12: Update review-plan.md — ✅ PASS
Valid [no-test]. Changes appropriately focus the deep reviewer on higher-order concerns.

## Missing Coverage
None — all 21 ACs are covered.

## Verdict: REVISE
Tasks 9 and 11 need revision. Task 9 is the critical one — the test migration for existing `handleSignal("plan_draft_done")` calls must be explicit.
