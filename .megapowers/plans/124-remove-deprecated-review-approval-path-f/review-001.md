---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 2
  - 3
  - 1
approved_tasks:
  - 2
  - 3
needs_revision_tasks:
  - 1
---

### Task 1: Route review approval instructions through megapowers_plan_review — ❌ REVISE
- **Coverage:** This task does not cover the active review instruction surface for AC1/AC2/AC6. It updates the `needsReviewApproval` branch in `extensions/megapowers/workflows/tool-instructions.ts`, but neither `extensions/megapowers/workflows/feature.ts` nor `extensions/megapowers/workflows/bugfix.ts` sets `needsReviewApproval: true` on the `plan` phase.
- **Self-containment / codebase realism:** The live plan-review prompt is assembled in `extensions/megapowers/prompt-inject.ts`, which unconditionally appends `deriveToolInstructions(...)` for the `plan` phase. Because the `plan` phase has `artifact: "plan.md"`, the active review prompt still appends the generic `plan.md` / `phase_next` instructions. The proposed implementation therefore would not fix the runtime behavior the spec cares about.
- **TDD completeness:** Step 1 should exercise `buildInjectedPrompt()` in `planMode: "review"`, not `deriveToolInstructions()` in isolation. As written, the test can pass while the actual review prompt still teaches the wrong flow.

### Task 2: Remove review_approve from the megapowers_signal tool surface — ✅ PASS
No blocking issues. The task covers the registered tool surface plus the preserved low-level deprecation path, uses real APIs (`handleSignal(tmp, "review_approve")`), and the implementation scope matches the acceptance criteria.

### Task 3: Remove the deprecated /review approve command surface — ✅ PASS
No blocking issues. The task targets the real command registration and handler wiring in `extensions/megapowers/index.ts` and `extensions/megapowers/commands.ts`, and the implementation is consistent with the current command structure.

### Missing Coverage
- **AC1 / AC2 / AC6 are not adequately covered by the current Task 1** because it tests an inactive helper branch instead of the active plan-review prompt path (`buildInjectedPrompt()` in review mode).
- Minor traceability note: task-to-AC coverage is mostly inferable from the titles, but Task 1 should explicitly call out its AC coverage when revised.

### Verdict
- **revise** — Task 1 needs to be retargeted to the active review prompt surface before the plan is ready for implementation.
