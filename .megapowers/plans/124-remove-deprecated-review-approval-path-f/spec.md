## Goal
Remove the deprecated `review_approve` approval path from the active pi-megapowers product surface so the live plan-review flow consistently teaches and uses `megapowers_plan_review`, while preserving a clear low-level deprecation error for stale callers of `handleSignal(..., "review_approve")`.

## Acceptance Criteria
1. Active workflow or prompt instruction generation used for plan review does not tell the model to approve a plan by calling `megapowers_signal({ action: "review_approve" })`.
2. Active workflow or prompt instruction generation that describes how to approve a plan directs approval through `megapowers_plan_review`, not through `megapowers_signal`.
3. The registered `megapowers_signal` tool schema does not include `review_approve` as an allowed `action` value, and the tool description does not advertise `review_approve` as a supported approval path.
4. The active review command surface does not support `/review approve` as the way to approve plan review, and active command wiring does not invoke `handleSignal(..., "review_approve")` for review approval.
5. Calling `handleSignal(cwd, "review_approve")` still returns a deprecation error that explicitly directs the caller to `megapowers_plan_review`.
6. Automated tests cover the active instruction surface, tool registration surface, command surface, and low-level deprecation path so regressions that re-teach or re-expose `review_approve` are caught.

## Out of Scope
- Redesigning the broader plan/review loop orchestration.
- Refactoring unrelated structural issues outside the deprecated review-approval-path cleanup.
- Cleaning historical or archived artifacts that mention `review_approve` when they are not part of the active product surface.
- Broad UI cleanup or unrelated architecture cleanup beyond the narrow active-surface drift covered by this issue.

## Open Questions
None.

## Requirement Traceability
- `R1 -> AC 1`
- `R2 -> AC 3`
- `R3 -> AC 4`
- `R4 -> AC 2`
- `R5 -> AC 5`
- `R6 -> AC 1, AC 3, AC 4`
- `R7 -> AC 6`
- `R8 -> Out of Scope`
- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `D3 -> Out of Scope`
- `C1 -> AC 5`
- `C2 -> AC 5`
- `C3 -> Out of Scope`
- `C4 -> Out of Scope`
- `C5 -> AC 1, AC 2`
