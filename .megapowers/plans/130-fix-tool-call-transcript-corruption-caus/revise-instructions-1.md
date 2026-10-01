# Plan revision instructions — iteration 1

## Task 2: Remove signal session-reset instructions

Fixed When 7 requires truthful user-facing next steps, not only removal of `triggerNewSession`. The proposed `handlePlanDraftDone(cwd: string): Promise<SignalResult>` still returns `orchestrated.value.message` unchanged. Its actual producer is `transitionDraftToReview(state: MegapowersState, taskCount: number): OrchestratorResult<PlanTransitionResult>` in `extensions/megapowers/plan-orchestrator.ts`.

At line 103 that producer currently says:

```ts
nextStep: "Transitioning to review mode. A new review session will start.",
```

Tasks 1–6 as written never correct this message. Add `extensions/megapowers/plan-orchestrator.ts` to Task 2's Files and `files_to_modify`. In Step 3, replace only this function's next-step string with:

```ts
nextStep: "Review mode is active in the current Pi session. Continue with plan review.",
```

Keep its guards, `nextState`, summary and task count unchanged. Preserve feedback content except for this explicitly obsolete session promise; update Task 2's blanket instruction to preserve all feedback accordingly.

In Step 1's existing `signal session policy` loop, immediately after `expect(result.error).toBeUndefined()`, add:

```ts
if (action === "plan_draft_done") {
  expect(result.message).toContain("current Pi session");
  expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
}
```

Keep the no-flag assertion and every fixture. Before implementation this message assertion fails with `Expected to contain: "current Pi session"`; the received message contains `A new review session will start.` Update Step 2 to describe this additional expected failure alongside the existing flag assertion. Keep the identical RED/GREEN command:

```sh
bun test tests/tool-signal.test.ts -t "signal session policy"
```

In Step 4 additionally run `bun test tests/tool-signal.test.ts tests/plan-orchestrator.test.ts`; Step 5 remains `bun test`.

## Task 3: Remove review session-reset instructions

The proposed revise path still returns `orchestrated.value.message` unchanged. Its actual producer is `transitionReviewToRevise(state: MegapowersState, approvedIds: number[], needsRevisionIds: number[], maxIterations: number): OrchestratorResult<PlanTransitionResult>` in `extensions/megapowers/plan-orchestrator.ts`.

At line 148 that producer currently says:

```ts
nextStep: "Transitioning to revise mode. A new review session will start.",
```

Add `extensions/megapowers/plan-orchestrator.ts` to Task 3's Files and `files_to_modify`. In Step 3 replace only this function's next-step string with:

```ts
nextStep: "Revise mode is active in the current Pi session. Update the tasks using the review feedback.",
```

Do not overwrite the whole orchestrator file: Task 2 will already have corrected `transitionDraftToReview`. Preserve iteration limits, iteration increment, status updates, feedback artifacts, and approve behavior. Task 3 can retain dependency `[depends: 1]` because its edit targets an independent existing function, and sequential execution preserves Task 2's edit.

In Step 1's existing verdict loop, immediately after `expect(result.error).toBeUndefined()`, add:

```ts
if (verdict === "revise") {
  expect(result.message).toContain("current Pi session");
  expect(result.message).not.toMatch(/new review session|starts a new session|fresh session/i);
}
```

Keep the no-flag assertion and both verdict fixtures. The existing approve-first flag failure remains accurate before any implementation; after flag cleanup, the revise message assertion independently fails until the next-step correction is implemented. Explain both in Step 2. Keep the identical RED/GREEN command:

```sh
bun test tests/tool-plan-review.test.ts -t "plan-review session policy"
```

In Step 4 additionally run `bun test tests/tool-plan-review.test.ts tests/plan-orchestrator.test.ts`; Step 5 remains `bun test`.

Update the plan overview's Fixed When 7 coverage to include Tasks 2–3 correcting tool-result next steps. Task 5's planned source search should then find no active automatic-session promise in either orchestrator result.
