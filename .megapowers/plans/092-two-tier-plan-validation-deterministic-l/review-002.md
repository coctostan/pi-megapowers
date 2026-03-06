---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 4
  - 6
  - 7
  - 8
  - 12
  - 3
  - 5
  - 9
  - 10
  - 11
approved_tasks:
  - 1
  - 2
  - 4
  - 6
  - 7
  - 8
  - 12
needs_revision_tasks:
  - 3
  - 5
  - 9
  - 10
  - 11
---

## Per-Task Assessment

### Task 1: Create LintResult type and lintTask — ✅ PASS
Correct types, tests, and implementation. Good foundation.

### Task 2: Add description minimum length check — ✅ PASS
`LintTaskInput = PlanTask & { description: string }` is the right approach. Content is correct despite `needs_revision` status.

### Task 3: Add depends_on validation — ❌ REVISE
**Bug:** Check order causes test failure. `depId=99` with `task.id=3`: `99 >= 3` is true → hits forward reference branch, but test expects "non-existent task 99". Fix: either change test expectations or restructure checks so forward references and non-existent IDs are tested with appropriate depIds.

### Task 4: Add duplicate files_to_create check — ✅ PASS
Correctly handles self-conflict exclusion. Tests cover all cases.

### Task 5: Integrate lintTask into handlePlanTask — ❌ REVISE
TypeScript type narrowing: `params.description` is `string | undefined` but `LintTaskInput` requires `string`. After the early return guard, use `params.description!`. Also explicitly show updated imports adding `listPlanTasks`.

### Task 6: Create plan-lint-model module — ✅ PASS
Clean CompleteFn injection, correct fail-open behavior.

### Task 7: Create lint-plan-prompt.md — ✅ PASS
Valid no-test justification.

### Task 8: Verify prompt assembly — ✅ PASS
Tests correctly verify template loading and interpolation.

### Task 9: Make handlePlanDraftDone async — ❌ REVISE
**Critical:** Making `handlePlanDraftDone` async breaks `handleSignal`'s sync return type and all existing tests calling `handleSignal(cwd, "plan_draft_done")`. Since Task 11 intercepts in register-tools.ts, remove the `plan_draft_done` case from `handleSignal`'s switch and export `handlePlanDraftDone` as standalone async function.

### Task 10: Graceful degradation — ❌ REVISE
Implementation fragment incomplete: doesn't show where `criteriaText`/`taskSummaries` are computed relative to the restructured `if/else`. Show the complete function body.

### Task 11: Wire in register-tools.ts — ❌ REVISE
1. `thinkingEnabled: false` is NOT a valid `ProviderStreamOptions` field — remove it.
2. `ctx.model` fallback could use an expensive model for "fast lint" — remove the fallback.
3. Source-level string tests are too exact — use semantic markers instead of exact statements.

### Task 12: Update review-plan.md — ✅ PASS
Valid no-test justification.

### Missing Coverage
None — all 21 ACs covered.

See `revise-instructions-2.md` for detailed fixes.
