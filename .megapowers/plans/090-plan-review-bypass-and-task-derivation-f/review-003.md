---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
approved_tasks: []
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
---

### Task 1: Add requirePlanApproved gate type and wire into workflow configs — ❌ REVISE
- **Coverage gap vs Fixed When #3:** Step 1 has tests for `planMode: "draft"` and `"revise"`, but **no test that plan→implement is allowed when `planMode === null`**. Add a third `it(...)` asserting `advancePhase(tmp).ok === true` when `planMode: null` (and `plan.md` exists).
- **Step 2 expected failure is too vague:** “FAIL — 3 tests fail…” doesn’t name the concrete assertion/error. Update Step 2 expected output to something like: `Expected: FAIL with assertion error (received true) at expect(result.ok).toBe(false)`.
- **Granularity:** Step 1 includes 3 separate `it(...)` blocks (draft, revise, checkGate). Consider either (a) keep them but explicitly justify that they are the minimal set for AC #1/#2/#3, or (b) split into smaller tasks.

### Task 2: Make extractPlanTasks accept ## headers and em-dash/hyphen separators + end-to-end deriveTasks test — ❌ REVISE
- **TDD ordering issue / duplicate coverage:** The plan already has an end-to-end test in `tests/reproduce-090.test.ts` (`BUG: deriveTasks returns [] when plan.md uses ## Task N — ...`). Instead of adding a “new additional test” in Step 5, **flip that existing test to expect 2 tasks as part of Step 1**. Otherwise you end up testing the same behavior twice and adding a “post-fix” test without a RED step.
- **Step count / structure:** Task has Steps 1–6; please collapse into the standard 5-step structure:
  1) flip all relevant failing assertions (## headers, em-dash separator, and the deriveTasks ##— scenario)
  2) run filtered test command (RED)
  3) implement regex change
  4) rerun same command (GREEN)
  5) run full suite
- **Step 2 expected failure too vague:** specify the concrete failing expectations (e.g. `expect(tasks.length).toBe(2)` received `0`).

### Task 3: Make deriveTasks prefer task files over plan.md parsing — ❌ REVISE
- **Implementation code is incorrect vs actual types:** `listPlanTasks()` returns `EntityDoc<PlanTask>` with `.data`, not `.meta`.
  - Fix mapping: `doc.data.id/title/no_test/depends_on`.
  - As written (`doc.meta...`) this will not compile and the task is not executable from the plan.
- **Step 2 filter is too broad/fragile:** `--filter "deriveTasks"` will match multiple tests (including existing ones). Use a unique substring in the new test name and filter on that exact string.
- **Step 2 expected failure too vague:** include the concrete assertion message/shape (received 0, expected 2).

### Task 4: Add plan_draft_done instruction to revise-plan.md prompt [no-test] — ❌ REVISE
- **files_to_modify is misleading:** If `prompts/write-plan.md` and `prompts/review-plan.md` are only audited (no edits expected), remove them from `files_to_modify` and keep them as explicit audit steps in the body.
- **Audit scope:** Step 2 greps only 3 files. To satisfy Fixed When #8 robustly, also add a command that confirms *all plan-phase templates* are clean (e.g. grep `phase_next` across `prompts/*plan*.md` or whatever the plan-phase templates set is in this repo).

### Missing Coverage
- **Fixed When #3** is not explicitly validated by any task yet (plan→implement allowed when `planMode === null`). Add this to **Task 1**.

### Overall verdict: revise
Core approach is correct (hard gate + canonical task-file derivation + parser leniency + prompt guidance), but Tasks 1–4 need edits for (a) one missing acceptance-criteria test, (b) stricter TDD step structure, and (c) a real compile-breaking mistake in Task 3 (`doc.meta` vs `doc.data`).
