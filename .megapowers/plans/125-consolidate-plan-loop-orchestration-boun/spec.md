## Goal

Consolidate plan-loop orchestration into a single `plan-orchestrator.ts` module that owns the lifecycle (draft → review → revise → approve), removing deprecated code paths and reducing cross-module fragmentation so the plan/review loop is easier to trace, test, and evolve.

## Acceptance Criteria

1. A `plan-orchestrator.ts` module exists in `src/` and exports functions that own all plan-loop mode transitions: draft → review, review → revise, review → approve.
2. The orchestrator validates transitions — e.g., `draft→review` requires current mode is `"draft"` or `"revise"`; `review→revise` requires current mode is `"review"` and iteration < `MAX_PLAN_ITERATIONS` (4); `review→approve` requires current mode is `"review"`.
3. The orchestrator owns iteration tracking — incrementing `planIteration` on revise, enforcing the max-iteration limit, and initializing plan state (mode=`"draft"`, iteration=1) on plan-phase entry.
4. The orchestrator exports a `resolvePlanTemplate(planMode)` function that returns the correct template filename: `"draft"` → `"write-plan.md"`, `"review"` → `"review-plan.md"`, `"revise"` → `"revise-plan.md"`.
5. `tool-signal.ts` `handlePlanDraftDone` delegates the draft→review state transition to the orchestrator instead of writing state directly.
6. `tool-plan-review.ts` `handleReviseVerdict` and `handleApproveVerdict` delegate mode transitions, iteration updates, task status updates, and legacy plan.md generation to the orchestrator instead of implementing them inline.
7. `tool-plan-task.ts` validates planMode guards by calling the orchestrator (or using its exported validation) rather than checking raw state fields inline.
8. `prompt-inject.ts` uses the orchestrator's `resolvePlanTemplate()` for template selection instead of maintaining its own inline `PLAN_MODE_TEMPLATES` map.
9. Approval side-effects — legacy `plan.md` generation (via `legacy-plan-bridge.ts`), task status updates to `"approved"`, and phase transition to `"implement"` — are coordinated through the orchestrator's approve path.
10. The `"review_approve"` action is removed from the signal handler's union type, switch case, and error stub in `tool-signal.ts`.
11. The `reviewApproved` field is removed from `MegapowersState`, `createInitialState()`, and all reset/transition sites in `state-machine.ts`.
12. The `needsReviewApproval` check and its associated `review_approve` instruction text are removed from `tool-instructions.ts`.
13. The orchestrator exports a pure `shouldRunFocusedReview(planMode, taskCount)` function. `hooks.ts` calls this function to decide whether to trigger the focused-review fan-out; fan-out execution remains in hooks.
14. All existing plan-loop behaviors are preserved: tool call inputs/outputs are unchanged, artifact file locations are unchanged, prompt template content is unchanged, iteration limits work identically, and the full test suite passes.
15. `plan-orchestrator.test.ts` covers: all valid mode transitions, rejection of invalid transitions, iteration counting and max-iteration enforcement, prompt template resolution per mode, `shouldRunFocusedReview` decision logic, and the approval side-effect sequence.

## Out of Scope

- Plan-review convergence improvements — this refactor enables future work but does not change convergence behavior.
- Plan entity infrastructure consolidation — `plan-store.ts`, `entity-parser.ts`, and `plan-schemas.ts` are not restructured in this issue.
- Focused-review fan-out mechanism changes beyond moving the decision into the orchestrator and keeping execution in hooks.
- Broader `prompt-inject.ts` refactoring beyond replacing plan-mode template selection with orchestrator-owned resolution.
- Optional extraction of a dedicated `PlanLoopState` type.
- Optional deeper extraction of revise-instructions loading or focused-review artifact injection from `prompt-inject.ts`.

## Open Questions

None.

## Requirement Traceability

- `R1 -> AC 1, AC 2, AC 3`
- `R2 -> AC 5, AC 6, AC 7`
- `R3 -> AC 4, AC 8`
- `R4 -> AC 9`
- `R5 -> AC 10`
- `R6 -> AC 11`
- `R7 -> AC 12`
- `R8 -> AC 13`
- `R9 -> AC 14`
- `R10 -> AC 15`
- `O1 -> Out of Scope`
- `O2 -> Out of Scope`
- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `D3 -> Out of Scope`
- `D4 -> Out of Scope`
- `C1 -> AC 14`
- `C2 -> AC 14`
- `C3 -> Out of Scope`
- `C4 -> AC 15`
- `C5 -> Out of Scope`
