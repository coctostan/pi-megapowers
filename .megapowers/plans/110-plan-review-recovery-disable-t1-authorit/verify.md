# Verification Report — Issue #110

## Test Suite Results

```
bun test
898 pass
0 fail
2100 expect() calls
Ran 898 tests across 84 files. [1182.00ms]
```

All 898 tests pass with zero failures.

---

## Bug Reproduction (Step 1b)

The original symptom was: `handlePlanDraftDone()` would call `lintPlanWithModel()`, and if it returned `verdict: "fail"`, the transition to review mode was blocked — keeping `planMode` as `"draft"`.

The test at `tests/tool-signal.test.ts:865-905` (describe: "handlePlanDraftDone — no T1 model gating") explicitly reproduces the prior scenario by passing a `failFn` that returns `{ verdict: "fail", findings: [...] }`. The result:

- `expect(result.error).toBeUndefined()` → **passes** (no error)
- `expect(result.triggerNewSession).toBe(true)` → **passes**
- `expect(readState(tmp2).planMode).toBe("review")` → **passes**

The symptom (T1 blocking the transition) no longer occurs.

---

## Per-Criterion Verification

### Criterion 1: `prompts/review-plan.md` no longer claims T0/T1 already verified coverage, dependency, or other mechanical/fundamental issues, and instead explicitly says earlier checks are advisory only.

**Evidence:** Inspected `prompts/review-plan.md`.

- Line 19: `"Treat any deterministic checks or earlier validation as advisory hints, not as authoritative approval. You still own the full review verdict. Re-check coverage, dependency ordering, TDD completeness, self-containment, and codebase realism yourself before approving or requesting revisions."`
- Line 54: `"...Earlier structural checks may be helpful hints, but you must still verify file paths, descriptions, imports, APIs, and error handling yourself."`
- No line claims T0 or T1 already verified coverage, dependencies, or mechanical issues.
- The broken text (`"The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1)..."`) is absent.

**Verdict:** ✅ **PASS**

---

### Criterion 2: `handlePlanDraftDone()` is back to being a simple transition — validate phase/mode, ensure task files exist, switch `planMode` to `review`, trigger a new session.

**Evidence:** Inspected `extensions/megapowers/tools/tool-signal.ts` lines 209–228.

```ts
export async function handlePlanDraftDone(cwd: string): Promise<SignalResult> {
  const state = readState(cwd);
  if (state.phase !== "plan") {
    return { error: "plan_draft_done can only be called during the plan phase." };
  }
  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
  }
  const tasks = listPlanTasks(cwd, state.activeIssue!);
  if (tasks.length === 0) {
    return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
  }
  writeState(cwd, { ...state, planMode: "review" });
  return {
    message:
      `📝 Draft complete: ${tasks.length} task${tasks.length === 1 ? "" : "s"} saved\n` +
      "  → Transitioning to review mode.",
    triggerNewSession: true,
  };
}
```

- Validates phase (lines 211–213) ✓
- Validates planMode (lines 214–216) ✓
- Checks task files exist (lines 217–220) ✓
- Switches `planMode` to `"review"` (line 221) ✓
- Returns `triggerNewSession: true` (line 226) ✓
- **No calls to `lintPlanWithModel` or any `completeFn`** ✓
- Function signature accepts only `cwd: string` — no second parameter ✓

Confirmed by grep: `grep -n "lintPlanWithModel\|completeFn" extensions/megapowers/tools/tool-signal.ts` → no output.

**Verdict:** ✅ **PASS**

---

### Criterion 3: `extensions/megapowers/register-tools.ts` no longer builds or passes a model completion function for `plan_draft_done`.

**Evidence:** Inspected `extensions/megapowers/register-tools.ts`.

- Line 42: `result = await handlePlanDraftDone(ctx.cwd);` — called directly with no second argument.
- No `buildLintCompleteFn` function defined anywhere in the file.
- No import of `CompleteFn` from `plan-lint-model.js`.
- No import of `complete` from `@mariozechner/pi-ai`.
- Confirmed by grep: `grep -n "buildLintCompleteFn\|lintPlanWithModel\|plan-lint-model" extensions/megapowers/register-tools.ts` → no output (exit 1 = no matches).
- `tests/register-tools.test.ts:68–76` independently asserts these strings are absent from the source file:
  - `expect(source).not.toContain("buildLintCompleteFn")` ✓
  - `expect(source).not.toContain('import { complete } from "@mariozechner/pi-ai"')` ✓
  - `expect(source).not.toContain('import type { CompleteFn } from "./validation/plan-lint-model.js"')` ✓
  - `expect(source).toContain("result = await handlePlanDraftDone(ctx.cwd);")` ✓

**Verdict:** ✅ **PASS**

---

### Criterion 4: Tests no longer encode T1 as part of the `plan_draft_done` contract, and still verify successful `plan_draft_done` transitions to review mode and starts a new session.

**Evidence:**

1. **T1 contract removed:** `grep -n "lintPlanWithModel\|T1\|buildLintCompleteFn" tests/tool-signal.test.ts` returns only:
   - Line 317: a task title string `"T1"` (irrelevant — it's a task title in test data)
   - Line 865: describe label `"handlePlanDraftDone — no T1 model gating"` — this asserts T1 is *gone*, not present
   - Line 899: `expect(result.message).not.toContain("T1")` — negated assertion confirming T1 is removed
   No test encodes T1 blocking as expected behavior.

2. **Transition and new session still verified:** `tests/tool-signal.test.ts:865–905`:
   - `expect(result.error).toBeUndefined()` → transition succeeds
   - `expect(result.triggerNewSession).toBe(true)` → new session triggered
   - `expect(readState(tmp2).planMode).toBe("review")` → planMode switched to review

3. **Register-tools test verifies clean wiring:** `tests/register-tools.test.ts:68–76` asserts no T1 imports or helpers exist in `register-tools.ts`, and that `handlePlanDraftDone(ctx.cwd)` is called directly.

4. **`plan-lint-model.ts` and its tests still exist** (for standalone utility use), but are no longer wired into the `plan_draft_done` transition path.

**Verdict:** ✅ **PASS**

---

## Overall Verdict

**PASS**

All four acceptance criteria are met with direct code evidence:

1. `prompts/review-plan.md` explicitly treats earlier checks as advisory only and restores full reviewer ownership.
2. `handlePlanDraftDone()` is a simple validate → check-tasks → write-state → new-session function with no model gate.
3. `register-tools.ts` calls `handlePlanDraftDone(ctx.cwd)` directly — no `buildLintCompleteFn`, no T1 completion function.
4. Tests assert the new simpler contract: T1 does not block `plan_draft_done`, successful transition sets `planMode: "review"` and `triggerNewSession: true`.

The full test suite passes with 898/898 tests, and the original bug symptom (T1 blocking review transition) is confirmed absent.
