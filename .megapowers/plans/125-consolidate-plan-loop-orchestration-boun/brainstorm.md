## Goal

The plan/review loop orchestration (draft → review → revise → approve) is currently spread across tools, hooks, prompt injection, state helpers, and workflow instruction generators with no single module owning the lifecycle. This makes the code path hard to trace, contributes to drift (e.g., deprecated `review_approve` still wired in), and makes future plan-review improvements riskier. The goal is to consolidate plan-loop lifecycle ownership into a single orchestrator module so the behavior is easier to understand, test, and evolve.

## Mode

`Direct requirements`

The problem is well-scoped by the issue, the fragmentation is mapped, and the consolidation target (new orchestrator module) is agreed. The main work is capturing the boundaries precisely.

## Must-Have Requirements

- **R1:** Create a new `plan-orchestrator.ts` module that owns all plan-loop lifecycle logic: mode transitions (draft → review → revise → approve), iteration tracking, and transition validation.
- **R2:** Tool handlers (`tool-plan-task.ts`, `tool-plan-review.ts`, `tool-signal.ts`) become thin dispatch layers — they validate input and delegate to the orchestrator for state transitions and side-effects.
- **R3:** Prompt template resolution for plan modes (draft → `write-plan.md`, review → `review-plan.md`, revise → `revise-plan.md`) is driven by the orchestrator rather than re-derived from raw state in `prompt-inject.ts`.
- **R4:** Approval side-effects (legacy `plan.md` generation via `legacy-plan-bridge.ts`, task status updates, gate satisfaction) are coordinated through the orchestrator.
- **R5:** Remove all `review_approve` signal handling — the deprecated switch case in `tool-signal.ts`, the union type member, and associated error handling.
- **R6:** Remove the `reviewApproved` field from state shape in `state-machine.ts` and all initialization/reset sites.
- **R7:** Remove the `needsReviewApproval` check and associated dead code in `tool-instructions.ts`.
- **R8:** The orchestrator exposes a pure decision function (e.g., `shouldRunFocusedReview(state, taskCount)`) that hooks calls to decide whether to trigger the focused-review fan-out. The fan-out execution itself stays in hooks.
- **R9:** All existing plan-loop behavior (draft, review, revise, approve, iteration limits) is preserved — this is a refactor, not a behavior change.
- **R10:** Orchestration-level tests cover the full draft → review → revise → approve lifecycle, mode transition validation, and edge cases (iteration limits, invalid transitions).

## Optional / Nice-to-Have

- **O1:** Extract the plan-mode-aware section of `prompt-inject.ts` (template selection, revise-instructions loading, focused-review artifact injection) into a helper the orchestrator owns or co-locates with, reducing `prompt-inject.ts` plan-awareness further.
- **O2:** Add a `PlanLoopState` type that encapsulates `planMode`, `planIteration`, and related fields as a cohesive unit rather than loose fields on the top-level state.

## Explicitly Deferred

- **D1:** Improving plan-review convergence behavior (Theme A concern) — this issue only makes that work safer, not solves it.
- **D2:** Consolidating plan entity infrastructure (`plan-store.ts`, `entity-parser.ts`, `plan-schemas.ts`) — these are already cohesive; the fragmentation problem is in orchestration, not storage.
- **D3:** Changing the focused-review fan-out mechanism or moving it out of hooks beyond the decision/execution split.
- **D4:** Broader prompt-inject refactoring beyond plan-mode concerns.

## Constraints

- **C1:** External behavior must be identical — tool call inputs/outputs, state.json shape (minus removed deprecated fields), artifact file locations, prompt content.
- **C2:** No new dependencies or abstraction frameworks — this is moving existing logic, not introducing new patterns.
- **C3:** The `plan-store.ts` / `entity-parser.ts` / `plan-schemas.ts` infrastructure layer is not in scope for restructuring.
- **C4:** Tests must remain pure (no pi dependency) per project convention.
- **C5:** The refactor must not become a broad architecture rewrite — it's targeted to plan-loop orchestration boundaries.

## Open Questions

None.

## Recommended Direction

Create `src/plan-orchestrator.ts` as the single owner of plan-loop lifecycle logic. This module exports functions for each lifecycle operation: transitioning to review mode, processing a review verdict (approve or revise), validating whether a transition is allowed, resolving the correct prompt template for the current mode, and deciding whether focused review should run. The tool handlers (`tool-signal.ts`, `tool-plan-task.ts`, `tool-plan-review.ts`) call into the orchestrator rather than implementing transition logic inline.

The deprecated `review_approve` path, `reviewApproved` state field, and `needsReviewApproval` tool-instruction check are removed as part of this work. These are dead code paths that exist only because there was no single module to clean up — once the orchestrator owns the lifecycle, the removal is straightforward and verifiable.

The focused-review fan-out stays in `hooks.ts` for execution, but the decision of whether to run it moves to the orchestrator. This gives hooks a clear contract: call `shouldRunFocusedReview()`, and if true, execute. The orchestrator stays testable without subagent mocks, and hooks stays a thin execution bridge.

Prompt-inject's plan-mode branching becomes a consumer of the orchestrator's `resolvePlanTemplate()` rather than re-deriving mode from raw state. This doesn't require restructuring prompt-inject broadly — just replacing the inline planMode switch with a function call.

## Testing Implications

- Unit tests for `plan-orchestrator.ts` covering: all valid mode transitions, rejection of invalid transitions, iteration counting and limits, prompt template resolution per mode, focused-review decision logic, approval side-effect coordination.
- Existing tool handler tests updated to verify they delegate to the orchestrator rather than implementing transitions inline.
- Integration-style tests that walk through the full lifecycle: draft tasks → submit for review → revise → re-submit → approve → verify implement phase reached.
- Verify deprecated code removal: no `review_approve` handling, no `reviewApproved` in state, no `needsReviewApproval` checks.
- Regression: existing test suite passes unchanged (behavior preservation).
