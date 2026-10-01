---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 4
  - 5
  - 6
  - 2
  - 3
approved_tasks:
  - 1
  - 4
  - 5
  - 6
needs_revision_tasks:
  - 2
  - 3
---

### Task 1: Preserve transition tool transcripts — ✅ PASS
Verified the existing two-case reproduction fails at the expected orphaned-result assertion. The proposed 56-fixture persistence matrix passes with only fixture reset suppression; production remains unchanged. APIs, state/artifact assertions, dependencies and TDD steps are grounded.

### Task 2: Remove signal session-reset instructions — ❌ REVISE
Fixed When 7 remains partially uncovered. Step 3 returns transitionDraftToReview's message unchanged, leaving extensions/megapowers/plan-orchestrator.ts:103 promising 'A new review session will start.' Add that source file to the task, correct the nextStep to state current-session preservation, and extend the failing handler test to assert the truthful message. Preserve guards and state updates. Exact changes are in revise-instructions-1.md.

### Task 3: Remove review session-reset instructions — ❌ REVISE
The revise path retains the same false promise from transitionReviewToRevise at extensions/megapowers/plan-orchestrator.ts:148. Add a targeted message correction and a behavioral assertion for the revise result, retaining Task 2's independent edit and all review artifacts/status/iteration behavior. Exact changes are in revise-instructions-1.md.

### Task 4: Describe session-preserving transitions — ✅ PASS
Descriptions and behavioral tests are grounded; no blocking issues.

### Task 5: Document the current session policy — ✅ PASS
Documentation-only justification and verification are appropriate; no blocking issues.

### Task 6: Document compatibility smoke checks — ✅ PASS
Installed-manager and isolated provider-check procedures use supported APIs/CLI options and explicitly distinguish offline validation from live provider results; no blocking issues.

### Missing Coverage
All eight Fixed When criteria are referenced, but criterion 7's truthful user-facing next steps is incomplete until Tasks 2–3 correct the orchestrator messages.

### Verdict
revise — approved_tasks [1,4,5,6], needs_revision_tasks [2,3]. The user confirmed this verdict. Prescriptive revision instructions were saved before submission at .megapowers/plans/130-fix-tool-call-transcript-corruption-caus/revise-instructions-1.md. Baseline verified: 868 pass, 2 expected reproduction failures.
