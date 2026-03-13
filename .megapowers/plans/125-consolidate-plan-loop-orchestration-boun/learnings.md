# Learnings — Issue 125
## Consolidate Plan Loop Orchestration

- **Circular import avoidance via DI callback is a clean pattern.** `approvePlan` accepts a `transitionToImplement: (state, tasks) => MegapowersState` callback rather than importing `transition()` directly — because `state-machine.ts` imports `initializePlanLoopState` from the orchestrator, creating a cycle if the orchestrator imported back. Recognizing and resolving this upfront (rather than after a circular-import runtime error) saved debugging time.

- **Discriminated result types (`{ok:true; value}|{ok:false; error}`) at orchestrator boundaries force explicit error handling without try/catch.** All seven exported functions use `OrchestratorResult<T>`. This made callers (`handlePlanDraftDone`, `handleReviseVerdict`, `handleApproveVerdict`) uniformly read and the pattern is self-documenting.

- **Pre-validation in callers that mirrors orchestrator validation is a DRY failure that re-emerges after refactoring.** `handlePlanDraftDone` retains its own `phase !== "plan"` and `planMode` checks even after the orchestrator owns those same checks. The refactor's goal was to move validation into the orchestrator, but the caller's guards weren't removed. Follow-up cleanup: remove the duplicate pre-checks in `handlePlanDraftDone`.

- **Source-inspection tests (reading `.ts` files and asserting `.not.toContain(...)`) are useful for coupling constraints but fragile.** Multiple new tests check that consumers imported the orchestrator function by name and didn't re-implement inline. This pattern catches drift but breaks on identifier renames. Use sparingly — only for "this code must not exist anymore" guarantees that have no behavioral test proxy.

- **Edit tooling can introduce indentation regressions when removing a line from an object literal.** Removing `reviewApproved: false,` from `ui.ts` at one of four sites left the next line (`currentTaskIndex: 0,`) with stray extra spaces. Multi-site removals in object literals need a post-edit visual pass for alignment.

- **The `shouldRunFocusedReview` promotion from implicit (call-context planMode guard) to explicit (planMode parameter) is a strict improvement.** The old `shouldRunFocusedReviewFanout(taskCount)` assumed it would only ever be called during review mode. The new signature documents the precondition and validates it, which is safer if the call site ever shifts.

- **Iteration enforcement belongs in the orchestrator, not the handler.** Moving the `planIteration >= MAX_PLAN_ITERATIONS` check from `tool-plan-review.ts` into `transitionReviewToRevise` means the limit is enforced regardless of which caller drives the revise transition — the policy travels with the state, not with the specific tool handler.
