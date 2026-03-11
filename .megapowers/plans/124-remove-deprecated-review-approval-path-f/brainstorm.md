## Goal
Remove the deprecated `review_approve` approval path from the active pi-megapowers product surface so plan review consistently uses `megapowers_plan_review`, while preserving a clear low-level deprecation error for stale callers that still invoke the old signal.

## Mode
`Direct requirements`

The issue is already concrete in the existing issue file, roadmap, and current code drift. The main need is to capture the required cleanup and boundaries clearly, not to explore multiple solution directions.

## Must-Have Requirements
1. **R1** Active workflow instructions must not tell the model to use `review_approve` to approve a plan.
2. **R2** The registered `megapowers_signal` tool surface must not advertise `review_approve` as a supported action.
3. **R3** The active command surface must not expose `/review approve` as the expected way to approve plan review.
4. **R4** The active plan review flow must consistently direct approval through `megapowers_plan_review`.
5. **R5** If stale code or prompts still call `handleSignal(..., "review_approve")`, the system must return a clear deprecation error that points to `megapowers_plan_review`.
6. **R6** The implementation must remove remaining active references to `review_approve` from command wiring, tool registration, and workflow/tool instruction generation.
7. **R7** Tests must cover the updated active product surface and guard against regression to teaching or exposing `review_approve`.
8. **R8** This issue must remain a product-coherence cleanup and must not redesign the plan review loop itself.

## Optional / Nice-to-Have
None.

## Explicitly Deferred
1. **D1** Redesigning the broader plan/review loop orchestration.
2. **D2** Refactoring unrelated structural issues outside the deprecated review-approval path cleanup.
3. **D3** Cleaning historical/archive artifacts that mention `review_approve` when they are not part of the active product surface.

## Constraints
1. **C1** Compatibility handling may remain at a low-level internal boundary if it only returns a deprecation message and does not advertise the deprecated path.
2. **C2** The cleanup must preserve clear migration guidance by pointing stale callers to `megapowers_plan_review`.
3. **C3** The work should follow YAGNI and stay narrowly scoped to active product-surface drift identified in this issue.
4. **C4** The solution should align with the roadmap’s Phase 0 structural-hardening goal of removing deprecated review-approval drift without broad UI or architecture cleanup.
5. **C5** Artifacts and prompts should be treated as part of the product surface when they actively teach the model what to do.

## Open Questions
None.

## Recommended Direction
The recommended approach is to distinguish sharply between the **active product surface** and **defensive backward-compatibility behavior**. Commands, registered tool schemas, and generated workflow instructions are the authoritative interface that teaches both users and the model how the system works. Those surfaces should stop mentioning `review_approve` entirely.

At the same time, retaining a low-level deprecation branch in the signal handler is a pragmatic compatibility safeguard. It prevents stale internal callers, tests, or prompts from failing mysteriously, while still reinforcing the new contract by returning a direct migration message to `megapowers_plan_review`. This preserves robustness without continuing to teach the deprecated path.

Implementation should therefore focus on the known drift points already visible in the codebase: `/review approve` command wiring, `megapowers_signal` registration/schema/description, and workflow/tool instruction generation. That keeps the issue tightly aligned with the roadmap’s structural-hardening intent and avoids scope creep into a larger plan-loop redesign.

Historical references in archived plans, changelogs, or prior issue artifacts do not need to be scrubbed as part of this slice unless they are still consumed by active product behavior. The success condition is not total textual eradication; it is removal of deprecated approval behavior from the live product contract.

## Testing Implications
- Verify active workflow/tool instruction generation no longer tells the model to call `review_approve`.
- Verify the registered `megapowers_signal` tool schema/description no longer presents `review_approve` as a supported action.
- Verify active command handling no longer supports `/review approve` as the approval path.
- Verify stale invocation of `handleSignal(..., "review_approve")` still returns a clear deprecation error mentioning `megapowers_plan_review`.
- Verify regression coverage for the plan review path points approval through `megapowers_plan_review`, not `megapowers_signal`.
