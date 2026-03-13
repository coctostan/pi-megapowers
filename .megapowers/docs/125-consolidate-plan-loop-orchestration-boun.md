# Feature: Consolidate Plan Loop Orchestration into plan-orchestrator.ts

**Issue:** 125-consolidate-plan-loop-orchestration-boun  
**Shipped:** 2026-03-13

---

## Summary

Introduced a single `extensions/megapowers/plan-orchestrator.ts` module that owns the entire plan-loop lifecycle — draft → review → revise → approve — consolidating logic that was previously fragmented across `tool-signal.ts`, `tool-plan-review.ts`, `tool-plan-task.ts`, `prompt-inject.ts`, and `hooks.ts`. Simultaneously removed all deprecated code paths (`review_approve`, `reviewApproved`, `requireReviewApproved`) that were left over from prior refactors.

---

## What Was Built

### `plan-orchestrator.ts` (new module)

The orchestrator exports seven pure or near-pure functions:

| Export | Purpose |
|--------|---------|
| `resolvePlanTemplate(planMode)` | Maps `draft/review/revise` to the correct `.md` prompt filename |
| `shouldRunFocusedReview(planMode, taskCount)` | Pure decision predicate for focused-review fan-out |
| `initializePlanLoopState(state)` | Returns new state with `planMode:"draft"`, `planIteration:1` |
| `validatePlanTaskMutation(state)` | Guards `megapowers_plan_task` from invalid modes |
| `transitionDraftToReview(state, taskCount)` | draft/revise → review with validated state update |
| `transitionReviewToRevise(state, approvedIds, needsRevisionIds, maxIterations)` | review → revise with iteration increment and max-iteration enforcement |
| `approvePlan(state, tasks, derivedTasks, transitionFn)` | Computes all approval side-effects: status updates, legacy plan.md, next state |

All transition functions return `OrchestratorResult<T>` — a discriminated union `{ok:true; value:T} | {ok:false; error:string}` — forcing explicit error handling at every call site.

### Consumer Wiring

- **`tool-signal.ts`** — `handlePlanDraftDone` calls `transitionDraftToReview` instead of writing `{planMode:"review"}` directly. `review_approve` switch case and union type entry removed entirely.
- **`tool-plan-review.ts`** — `handleReviseVerdict` calls `transitionReviewToRevise`; `handleApproveVerdict` calls `approvePlan` via DI callback (avoiding circular import with `state-machine`).
- **`tool-plan-task.ts`** — validation guard replaced by single `validatePlanTaskMutation()` call.
- **`prompt-inject.ts`** — local `PLAN_MODE_TEMPLATES` map replaced by `resolvePlanTemplate()`.
- **`hooks.ts`** — `shouldRunFocusedReviewFanout(taskCount)` replaced by `shouldRunFocusedReview(state.planMode, taskCount)` — now also validates planMode explicitly.
- **`state-machine.ts`** — plan-phase entry delegates to `initializePlanLoopState` via `Object.assign`.

### Deprecated Code Removed

- `reviewApproved` field from `MegapowersState`, `createInitialState()`, `state-io.ts` KNOWN_KEYS, and all four object literals in `ui.ts`.
- `requireReviewApproved` gate from `gate-evaluator.ts` and its type from `workflows/types.ts`.
- `handleReviewApprove()` stub function from `tool-signal.ts`.
- `needsReviewApproval` instruction block from `tool-instructions.ts`.
- `PLAN_MODE_TEMPLATES` inline map from `prompt-inject.ts`.

---

## Why

The plan-loop orchestration was spread across five consumer modules. Each module re-implemented partial validation, state mutation, and error messages independently. This made the loop difficult to trace (no single authoritative path), test (behaviors coupled to I/O), and evolve (any change required coordinating across multiple files).

The orchestrator pattern gives:
1. **A single source of truth** for what each transition means and what state it produces.
2. **Testability without I/O** — all orchestrator functions are pure or near-pure, tested directly in `plan-orchestrator.test.ts` without touching the filesystem.
3. **Explicit contracts** — the `OrchestratorResult<T>` type makes the success/failure boundary visible at call sites.

---

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/plan-orchestrator.ts` | **Created** |
| `tests/plan-orchestrator.test.ts` | **Created** |
| `tests/tool-plan-review-delegation.test.ts` | **Created** |
| `tests/tool-plan-task-delegation.test.ts` | **Created** |
| `tests/prompt-inject-plan-orchestrator.test.ts` | **Created** |
| `extensions/megapowers/hooks.ts` | Modified — orchestrator decision |
| `extensions/megapowers/prompt-inject.ts` | Modified — `resolvePlanTemplate` |
| `extensions/megapowers/state/state-machine.ts` | Modified — `reviewApproved` removed, plan-entry delegated |
| `extensions/megapowers/state/state-io.ts` | Modified — KNOWN_KEYS cleanup |
| `extensions/megapowers/tools/tool-plan-review.ts` | Modified — orchestrator delegation |
| `extensions/megapowers/tools/tool-plan-task.ts` | Modified — orchestrator validation |
| `extensions/megapowers/tools/tool-signal.ts` | Modified — `review_approve` removed, delegation |
| `extensions/megapowers/ui.ts` | Modified — `reviewApproved` removals |
| `extensions/megapowers/workflows/gate-evaluator.ts` | Modified — dead gate removed |
| `extensions/megapowers/workflows/tool-instructions.ts` | Modified — dead instruction block removed |
| `extensions/megapowers/workflows/types.ts` | Modified — dead gate type removed |

---

## Test Coverage

- **783 tests pass** across 78 files.
- `plan-orchestrator.test.ts`: 3 test groups, 28 assertions covering all exported functions.
- 4 source-inspection tests enforce coupling constraints (delegation must use named orchestrator functions, not inline reimplementations).
