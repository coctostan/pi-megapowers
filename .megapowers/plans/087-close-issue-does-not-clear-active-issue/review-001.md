---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
approved_tasks: []
needs_revision_tasks:
  - 1
---

### Task 1: Fix `onAgentEnd` to clear state on close-issue and always consume non-content-capture done actions — ❌ REVISE

- **TDD Step 1 is non-compliant:** it says “test already written; no changes needed” but does **not** include the **full test code** inline. Per plan rules, Step 1 must contain the complete test contents (even if it already exists in-repo).
- **Step 2 expected failure output is a bit vague:** “0 pass, 6 fail” + “Key errors” is close, but please include at least one **exact** bun assertion failure snippet (test name + received/expected) so a dev can confirm they’re seeing the same failure.
- **Granularity:** this single task fixes **two independent bugs** (close-issue reset + doneActions consumption gating) and drives **6 tests** at once. Either (a) split into two tasks (one for close-issue reset + related tests; one for consuming non-content actions) or (b) explicitly justify why it must stay combined and update Step 2 to clarify which subset of failures is expected before each fix.
- **Minor implementation note:** the proposed `return;` after handling `close-issue` will skip the dashboard refresh. Not necessarily wrong, but if you keep it, call out why skipping the immediate re-render is desired (or remove the `return` so the UI reflects the idle state immediately).

### Missing Coverage
No acceptance-criteria gaps detected (the existing `tests/hooks-close-issue.test.ts` appears to cover Fixed-When 1–7), but the plan write-up needs the Step 1/2 TDD details above to be executable from the plan alone.

