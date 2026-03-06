# Spec: Two-Tier Plan Validation

## Goal

Add two pre-screening validation tiers to the plan authoring loop — deterministic per-task lint (T0) in the `megapowers_plan_task` handler and a fast-model whole-plan lint (T1) in `handlePlanDraftDone` — so that mechanical and coherence errors are caught inline before the expensive deep-review session break (T2), reducing total review iterations and time.

## Acceptance Criteria

**T0 — Deterministic per-task lint (in `megapowers_plan_task`)**

1. When `megapowers_plan_task` is called with an empty or whitespace-only `title`, the tool returns an error and the task is not saved.
2. When `megapowers_plan_task` is called with a `description` shorter than 200 characters, the tool returns an error and the task is not saved.
3. When `megapowers_plan_task` is called with both `files_to_modify` and `files_to_create` empty, the tool returns an error and the task is not saved.
4. When `megapowers_plan_task` is called with a `depends_on` array containing a task ID that does not exist among already-saved tasks, the tool returns an error and the task is not saved.
5. When `megapowers_plan_task` is called with a `depends_on` array containing a task ID >= the current task's own ID, the tool returns an error and the task is not saved.
6. When a task's `files_to_create` contains a path already claimed by another task's `files_to_create`, the tool returns an error and the task is not saved.
7. All T0 checks use only structural operations (string length, `includes()`, array/set operations, numeric comparisons) — no regular expressions.
8. T0 lint logic lives in a pure function `lintTask(task, existingTasks)` that returns `{ pass: true }` or `{ pass: false, errors: string[] }`.
9. When T0 fails, the returned error message includes all failing check descriptions (not just the first).

**T1 — Fast-model whole-plan lint (in `handlePlanDraftDone`)**

10. When `plan_draft_done` is signaled, a fast-model lint call is made before transitioning to review mode.
11. The T1 prompt includes the full set of saved tasks and the spec/acceptance criteria for the active issue.
12. The T1 model call uses `@mariozechner/pi-ai`'s `complete()` function with thinking disabled, not `pi-subagents`.
13. The LLM call function (`completeFn`) is injected as a dependency so tests can provide a mock without real API keys.
14. When T1 returns findings (issues found), the `plan_draft_done` tool returns them as an error, no state transition occurs, and the drafter can fix tasks and retry.
15. When T1 returns a pass (no issues), the state transitions to review mode and `triggerNewSession` is set as before.
16. When the T1 model's API key is not available, T1 is skipped with a warning message in the tool result, and the flow proceeds to T2 (review mode + session break).
17. The T1 response is parsed as structured pass/fail — if the model returns a malformed response, it is treated as a pass (fail-open) with a warning.
18. A new prompt template `lint-plan-prompt.md` provides the T1 model its instructions: check spec coverage, cross-task dependency coherence, description substantiveness, and file path plausibility.

**T2 — Deep review prompt update**

19. The `review-plan.md` prompt is updated to remove mechanical/structural checks that are now covered by T0 and T1, focusing the deep reviewer on architecture, approach soundness, and implementation correctness.

**Integration**

20. `handlePlanDraftDone` becomes async to support the T1 model call.
21. The tool registration in `register-tools.ts` properly awaits the async `handlePlanDraftDone`.

## Out of Scope

- Configurable T0 thresholds (e.g. minimum description length) — hardcoded for now.
- T1 model selection UI — model choice is hardcoded with a fallback; no user-facing config.
- Persisting T1 lint results to disk — results are returned inline and not stored.
- Changes to the T2 review tool (`megapowers_plan_review`) — only the prompt changes.
- Per-task T1 lint — the fast model only runs on the full plan at submission.

## Open Questions

(none)
