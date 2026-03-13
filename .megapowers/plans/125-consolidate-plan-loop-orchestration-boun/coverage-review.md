## Coverage Summary
- Overall: covered
- Planning input: spec.md

## AC-by-AC Findings

- AC 1 — covered
  - Tasks: 2, 3, 4
  - Finding: Task 2 implements `initializePlanLoopState` and `transitionDraftToReview`, Task 3 adds `transitionReviewToRevise`, Task 4 adds `approvePlan` — all three plan-loop mode transitions are exported from plan-orchestrator.ts.

- AC 2 — covered
  - Tasks: 2, 3, 4
  - Finding: Task 2 validates `draft→review` mode requirements, Task 3 validates `review→revise` mode and iteration < MAX_PLAN_ITERATIONS, Task 4 validates `review→approve` mode requirement.

- AC 3 — covered
  - Tasks: 2, 3, 11
  - Finding: Task 3's `transitionReviewToRevise` increments `planIteration` and enforces max limit, Task 2's `initializePlanLoopState` sets mode="draft" and iteration=1, Task 11 delegates plan-phase entry initialization to the orchestrator.

- AC 4 — covered
  - Tasks: 1
  - Finding: Task 1 implements and tests `resolvePlanTemplate(planMode)` with exact template mapping: draft→write-plan.md, review→review-plan.md, revise→revise-plan.md.

- AC 5 — covered
  - Tasks: 6
  - Finding: Task 6 replaces `handlePlanDraftDone` to call `transitionDraftToReview` instead of writing state fields directly.

- AC 6 — covered
  - Tasks: 5
  - Finding: Task 5 replaces `handleReviseVerdict` and `handleApproveVerdict` to delegate all mode transitions, iteration updates, task status updates, and legacy plan.md generation to orchestrator functions.

- AC 7 — covered
  - Tasks: 7
  - Finding: Task 7 replaces inline planMode guards in tool-plan-task.ts with `validatePlanTaskMutation` call and removes raw state field checks.

- AC 8 — covered
  - Tasks: 8
  - Finding: Task 8 imports `resolvePlanTemplate` from plan-orchestrator and removes the local `PLAN_MODE_TEMPLATES` map from prompt-inject.ts.

- AC 9 — covered
  - Tasks: 4, 5
  - Finding: Task 4's `approvePlan` returns status updates, legacy plan.md text, and next state; Task 5 wires these effects (updateTaskStatuses, writeFileSync plan.md, writeState) in handleApproveVerdict.

- AC 10 — covered
  - Tasks: 6
  - Finding: Task 6 removes `"review_approve"` from the signal handler union type, deletes the switch case, and deletes `handleReviewApprove` entirely.

- AC 11 — covered
  - Tasks: 10, 11, 12
  - Finding: Task 11 removes `reviewApproved` from `MegapowersState` and `createInitialState`, Task 10 removes `RequireReviewApprovedGate` type and evaluator case, Task 12 removes `reviewApproved` from KNOWN_KEYS and UI state writes.

- AC 12 — covered
  - Tasks: 13
  - Finding: Task 13 deletes the `needsReviewApproval` conditional block and associated review_approve instruction text from tool-instructions.ts.

- AC 13 — covered
  - Tasks: 1, 9
  - Finding: Task 1 implements pure `shouldRunFocusedReview(planMode, taskCount)` function, Task 9 imports and calls it from hooks.ts while keeping fan-out execution in hooks.

- AC 14 — covered
  - Tasks: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
  - Finding: Every task includes TDD Step 5 "Verify no regressions" running full test suite; no changes to tool call inputs/outputs, artifact locations, or prompt template content are specified.

- AC 15 — covered
  - Tasks: 1, 2, 3, 4
  - Finding: Tasks 1–4 progressively build plan-orchestrator.test.ts covering prompt helpers, entry/draft transitions, review validators (mode rejection, iteration caps), and approve effects sequence.

## Missing Coverage
None

## Weak Coverage / Ambiguities
None

## Notes for the Main Reviewer
- AC 9 spans two tasks (4 plans the effects, 5 wires them) — both must execute correctly for the approve path to work end-to-end.
- AC 11 removal is distributed across three tasks (10: gates, 11: state-machine, 12: persistence/UI) — all three must complete for full cleanup.
- AC 14 (regression preservation) relies on Step 5 execution discipline across all 13 tasks.
