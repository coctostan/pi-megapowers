# Code Review — Issue 125
## Consolidate Plan Loop Orchestration

**Reviewed:** 2026-03-13

---

## Files Reviewed

| File | Change type |
|------|-------------|
| `extensions/megapowers/plan-orchestrator.ts` | **New** — orchestrator module owning all plan-loop mode transitions |
| `extensions/megapowers/hooks.ts` | Modified — imports `shouldRunFocusedReview` from orchestrator |
| `extensions/megapowers/prompt-inject.ts` | Modified — uses `resolvePlanTemplate()` from orchestrator |
| `extensions/megapowers/state/state-machine.ts` | Modified — removes `reviewApproved`, delegates plan-entry init to orchestrator |
| `extensions/megapowers/state/state-io.ts` | Modified — removes `reviewApproved` from `KNOWN_KEYS` |
| `extensions/megapowers/tools/tool-plan-review.ts` | Modified — delegates to `approvePlan`/`transitionReviewToRevise` |
| `extensions/megapowers/tools/tool-plan-task.ts` | Modified — uses `validatePlanTaskMutation` from orchestrator |
| `extensions/megapowers/tools/tool-signal.ts` | Modified — removes `review_approve`, delegates to `transitionDraftToReview` |
| `extensions/megapowers/ui.ts` | Modified — removes `reviewApproved` from four object literals |
| `extensions/megapowers/workflows/gate-evaluator.ts` | Modified — removes `requireReviewApproved` gate case |
| `extensions/megapowers/workflows/tool-instructions.ts` | Modified — removes `needsReviewApproval` block |
| `extensions/megapowers/workflows/types.ts` | Modified — removes `RequireReviewApprovedGate` type |
| `tests/plan-orchestrator.test.ts` | **New** — unit tests for all orchestrator functions |
| `tests/prompt-inject-plan-orchestrator.test.ts` | **New** — source-inspection test for prompt-inject wiring |
| `tests/tool-plan-review-delegation.test.ts` | **New** — source-inspection test for tool-plan-review delegation |
| `tests/tool-plan-task-delegation.test.ts` | **New** — source-inspection test for tool-plan-task delegation |
| `tests/hooks-focused-review.test.ts` | Modified — adds planMode-aware tests |
| `tests/gate-evaluator.test.ts` | Modified — replaces behavioral tests with source-inspection for removed gate |
| `tests/state-machine.test.ts` | Modified — removes `reviewApproved` assertions, adds delegation check |
| `tests/tool-signal.test.ts` | Modified — updates `review_approve` from deprecation-error to unknown-action |
| `tests/workflow-configs.test.ts` | Modified — adds source-inspection for tool-instructions cleanup |
| `tests/phase-advance.test.ts` | Modified — updates `reviewApproved` test to check orchestrator delegation |
| `tests/state-io.test.ts` | Modified — adds `reviewApproved` removal and KNOWN_KEYS tests |

---

## Strengths

**Circular-import avoidance via DI callback (`plan-orchestrator.ts:145–171`):**  
`approvePlan` takes a `transitionToImplement: (state, tasks) => MegapowersState` callback rather than importing `transition()` directly from `state-machine.ts`. This correctly sidesteps the circular dependency (`state-machine` → `plan-orchestrator` → `state-machine`). The design choice is sound and well-executed.

**Result type for all orchestrator functions:**  
Every exported transition function returns `OrchestratorResult<T>` (discriminated union `{ok: true; value: T} | {ok: false; error: string}`). Callers are forced to handle errors explicitly — no exceptions thrown, no null returns. This is consistent and safe.

**`initializePlanLoopState` fully owning plan-entry initialization (`state-machine.ts:130–132`):**  
```ts
if (to === "plan") {
  Object.assign(next, initializePlanLoopState(next));
}
```
The delegation is clean and complete. `state-machine.ts` no longer has any knowledge of what `planMode` and `planIteration` values mean on entry.

**`shouldRunFocusedReview` now explicit about planMode (`plan-orchestrator.ts:44–46`):**  
Previously `shouldRunFocusedReviewFanout(taskCount)` in `focused-review.ts` only checked task count; the planMode guard was implicit from call context. The new function explicitly validates `planMode === "review"`, which is both more readable and more correct if the call site ever shifts.

**`PLAN_MODE_TEMPLATES` local map replaced with `resolvePlanTemplate()` (`prompt-inject.ts:218`):**  
Clean substitution — from an inline `Record<>` literal to a single named function call. Easy to trace.

**Complete cleanup of the deprecated approval chain:**  
`RequireReviewApprovedGate`, `reviewApproved` field, `handleReviewApprove` stub, `requireReviewApproved` gate case, and `needsReviewApproval` instruction block are all removed across seven files. No dead code left along the deprecated path.

**`state-io.ts` KNOWN_KEYS updated:**  
`reviewApproved` correctly removed from the allowlist, so any old state.json containing this field will silently drop it on read. The corresponding test (`state-io.test.ts`) proves round-trip hygiene.

---

## Findings

### Critical

None.

---

### Important

**[I1] `handlePlanDraftDone` duplicates orchestrator validation (`tool-signal.ts:209–214`)**  
```ts
// tool-signal.ts lines 209-214 — ALSO checked inside transitionDraftToReview
if (state.phase !== "plan") {
  return { error: "plan_draft_done can only be called during the plan phase." };
}
if (state.planMode !== "draft" && state.planMode !== "revise") {
  return { error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.` };
}
```
`transitionDraftToReview` (orchestrator lines 84–93) checks these same two conditions with identical error text. The pre-validation in the handler means the orchestrator's error paths for these cases are unreachable when called from this handler. If the orchestrator's validation logic or error messages ever change, the handler's pre-checks become silently stale and divergent.  
**Fix:** Remove lines 209–214 from `handlePlanDraftDone` and let the orchestrator own the validation. The empty-tasks check (line 215–218) must stay since it's handler-specific. The tests only assert `.error` is defined or contains "plan phase" — both still satisfied by the orchestrator's message `"plan_draft_done can only be called during the plan phase."`.

---

**[I2] Indentation regression in `ui.ts:370`**  
```ts
// Line 370 — 18 spaces instead of 14
                  currentTaskIndex: 0,
// All surrounding lines use 14 spaces
              completedTasks: [],
              tddTaskState: null,
```
When `reviewApproved: false,` was removed from the object literal at line ~367 in the original, the cursor of the edit tool left `currentTaskIndex` with stray extra leading spaces. The object literal at lines 364–374 is the only occurrence with this bug (`ui.ts` has four similar removal sites; only this one was affected).  
**Fix:** Correct to 14-space indent: `              currentTaskIndex: 0,`.

---

### Minor

**[M1] Stale comment in `tool-signal.ts:272`**  
```ts
// Note: reviewApproved is reset by transition() in state-machine.ts
// when to === "plan". No explicit intermediate write needed here.
```
`reviewApproved` was removed from `MegapowersState`. This comment refers to a field that no longer exists. It appears in `handlePhaseBack`, describing why no intermediate write is needed for a plan backward transition — the second sentence is still correct but the reason (resetting `reviewApproved`) is wrong.  
**Fix:** Remove or rewrite as `// transition() already resets plan-loop state when entering plan.`

---

**[M2] Triple blank lines in `tool-signal.ts:231–234`**  
After the `handleReviewApprove` function block was deleted, three empty lines remain between `handlePlanDraftDone` and the `// phase_next` separator comment. Convention in this file is a single blank line before the separator.  
**Fix:** Collapse to one blank line.

---

**[M3] Dead `needsReviewApproval` field on `PhaseConfig` (`workflows/types.ts:69`)**  
```ts
needsReviewApproval?: boolean;  // phase requires review approval to advance
```
The only consumer of this field (`tool-instructions.ts`) was removed in this issue. No workflow config sets this property. The `tool-instructions.ts` test asserts it's gone from that file, but this field remains in the type definition as dead interface property.  
**Note:** Not in scope per AC12 (which targets `tool-instructions.ts`), but it's now unreferenced dead code.  
**Fix (recommended follow-up):** Remove the field and its comment.

---

**[M4] Double task-status write on approve path (`tool-plan-review.ts:62` and `:110–115`)**  
`handlePlanReview` (line 62) calls `updateTaskStatuses(cwd, slug, approvedIds, "approved")` for the explicitly-listed approved tasks. Then `handleApproveVerdict` (lines 110–115) calls `updateTaskStatuses` again for ALL tasks from `orchestrated.value.statusUpdates`. The second write supersedes the first; the first is redundant for the approve path.  
**Impact:** None behavioral — writes are idempotent. But it signals the two status-update paths aren't cleanly separated.  
**Note:** For the revise path, task status updates happen only in the pre-processing (lines 62–63), not in the orchestrator's revise path. AC6 says "handleReviseVerdict delegates task status updates to the orchestrator" — the actual update is in `handlePlanReview` common pre-processing rather than in the orchestrator's revise function, which is a partial delegation. Acceptable given the verify phase passed this, but worth noting for future cleanup.

---

**[M5] Source-inspection tests replacing behavioral tests (`gate-evaluator.test.ts:59–72`)**  
```ts
describe("dead requireReviewApproved gate removal", () => {
  it("workflow types and gate evaluator source no longer mention requireReviewApproved", () => {
    // reads source files and checks .not.toContain(...)
  });
});
```
The two behavioral tests (`fails when reviewApproved is false`, `passes when reviewApproved is true`) were replaced with a source-inspection test. Source-inspection tests are brittle (they break on identifier renames, whitespace changes, file moves) and don't test behavior. Three other new test files (`tool-plan-review-delegation.test.ts`, `tool-plan-task-delegation.test.ts`, `prompt-inject-plan-orchestrator.test.ts`) are also pure source-inspection. They serve as coupling constraints but add fragility.  
**Note:** The project already uses source-inspection tests in several places, so this is consistent with existing conventions. The behavioral coverage for the removed gate is adequately covered by the `requirePlanApproved` gate tests that replaced it.

---

## Recommendations

1. **Remove the duplicate pre-validation from `handlePlanDraftDone`** (finding I1) to complete the refactor's intent. Once the orchestrator owns validation, the handler shouldn't re-implement it. Low risk: test assertions on error text are satisfied by the orchestrator's identical messages.

2. **Fix `ui.ts:370` indentation** (finding I2) before merge. It's a clear mechanical regression from the `reviewApproved` removal edit.

3. **Fix stale comment and triple blank lines in `tool-signal.ts`** (M1, M2) as part of final polish.

4. **Track the dead `needsReviewApproval` field in `types.ts`** (M3) — clean it up in the next refactor touching workflow types.

---

## Assessment

**ready**

No critical bugs, data loss risks, or behavioral regressions were found. The core refactor is well-executed: the orchestrator cleanly owns mode transitions, iteration tracking, and template resolution; all deprecated code paths are removed; the DI callback for `approvePlan` correctly avoids circular imports; and the full test suite (783/783) passes.

The Important findings (I1: duplicate validation, I2: indentation regression) are genuine quality gaps. I1 is a maintainability smell that mildly undermines the refactor's stated goal, and I2 is a cosmetic regression. Neither blocks correctness. The TDD guard prevents inline fixes during code-review without a full red-green cycle; these are best addressed in a lightweight follow-up commit or the done-phase cleanup. All Minor findings are style/cleanup items.
