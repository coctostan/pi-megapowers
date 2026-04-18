---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
needs_revision_tasks:
  - 7
---

### Task 1: Inline tool hints for brainstorm/spec prompts — ✅ PASS
No issues.

### Task 2: Inline tool hints for plan/review prompts — ✅ PASS
No issues.

### Task 3: Inline tool hints for revise/implement prompts — ✅ PASS
No issues.

### Task 4: Inline tool hints for verify/code-review prompts — ✅ PASS
No issues.

### Task 5: Inline tool hints for reproduce/diagnose prompts — ✅ PASS
No issues.

### Task 6: Inline tool hints for done prompt — ✅ PASS
No issues.

### Task 7: Document tool mapping plus injected-prompt coverage — ❌ REVISE
- Step 1's doc-sync test is too weak for AC 13 / AC 15. It only checks that `docs/phase-tools.md` contains each prompt name and tool token somewhere, so it will not fail on stale extra rows, wrong section/step text, wrong rationale text, or a tool listed under the wrong prompt.
- Task 7 is internally inconsistent with approved Task 4: the proposed matrix/doc content lists `read` for `prompts/verify.md`, but Task 4 does not add a `read` hint to `prompts/verify.md`. As written, the task would either document fictional guidance or require an unplanned cross-task change.
- Step 3 is not self-contained for `tests/prompt-inject.test.ts`. "Extend ... with a new describe block" is prose, not copy-pasteable test code, and it does not specify the required `setState(...)` setup for plan draft/review/revise, bugfix phases, or done mode.

### Missing Coverage
No acceptance criteria are completely uncovered by the task list. AC 13 and AC 15 are assigned to Task 7, but Task 7's current test plan is not strong enough yet to enforce them.

### Verdict
revise — Task 7 needs a stronger exact doc-sync test, alignment with the approved `verify.md` tool hints, and real copy-pasteable `tests/prompt-inject.test.ts` code.
