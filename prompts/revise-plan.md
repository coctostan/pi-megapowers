You are revising a plan based on reviewer feedback.

> **Workflow:** brainstorm → spec → **plan (revise)** → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

## Reviewer's Instructions
{{revise_instructions}}

## Quality Bar

Your revision will be reviewed against these 6 criteria — the same ones the reviewer used. Every task must pass all of them.

### 1. Coverage
Every acceptance criterion from the spec maps to at least one task.

### 2. Ordering & Dependencies
Tasks depend only on earlier tasks. No forward references. `[depends: N]` annotations are present and correct.

### 3. TDD Completeness
Every non-`[no-test]` task has all 5 steps with **real, complete code**:
- **Step 1** — Full, copy-pasteable test code. Not pseudocode, not "similar to Task 3".
- **Step 2** — Exact run command + the **specific error message** the runner will print.
- **Step 3** — Full, copy-pasteable implementation code. Just enough to pass.
- **Step 4** — Same run command as Step 2, expected PASS.
- **Step 5** — Full test suite command, expected all passing.

### 4. Granularity
Each task is one test + one implementation. One logical change, ≤3 files.

### 5. No-Test Validity
Only config/docs/CI/prompt tasks use `[no-test]`. Each has a justification and a verification step.

### 6. Self-Containment
Each task has actual code, real file paths, real function signatures. No "similar to Task N", no placeholders.

## Instructions

1. Read the reviewer's instructions above — these are your primary guide
2. Read task files in `.megapowers/plans/{{issue_slug}}/tasks/`
3. Fix **only** the tasks marked `needs_revision`. Don't touch `approved` tasks unless the reviewer explicitly said to.
4. For each revised task, check it against the rejection reason — don't just tweak wording, fix the actual problem.

For frontmatter/task metadata updates, use:
```
megapowers_plan_task({ id: N, depends_on: [1, 2], files_to_modify: [...] })
```

**For body changes** (implementation details, test code):
Use `read` + `edit` to make surgical changes to existing task files.

## Most Common Revision Failures

Revisions get rejected again when they fix the surface complaint but not the root cause:

| ❌ What you did | ✅ What you should have done |
|---|---|
| Reviewer said "add specific error" → you wrote "Expected: FAIL — test fails" | Write the actual error: "Expected: FAIL — TypeError: x is not a function" |
| Reviewer said "split this task" → second half says "similar to above" | Each split task has its own full test + implementation code |
| Reviewer said "missing coverage" → you added a task with just a description | Write the full 5-step TDD task with real code |
| Reviewer said "incomplete Step 3" → you added a comment placeholder | Write the actual implementation code |
| Reviewer said "Step 1 is pseudocode" → you expanded the description | Replace the description with copy-pasteable test code |

## Pre-Submit Checklist

Before calling `megapowers_signal({ action: "plan_draft_done" })`, walk through EVERY revised task and verify:

- [ ] **Reviewer's points addressed:** Each specific instruction from the reviewer is resolved
- [ ] **Step 1:** Test code is complete and runnable — no placeholders, no `// TODO`
- [ ] **Step 2:** Expected failure message is the specific error text, not "should fail"
- [ ] **Step 3:** Implementation code is complete and uses actual codebase APIs
- [ ] **Step 4/5:** Run commands are correct
- [ ] **Self-contained:** No "similar to Task N" — every task stands alone
- [ ] **File paths:** All paths verified against actual codebase structure

If any check fails, fix it before submitting.

## When Done

After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
Do not use direct phase-advance actions here — the plan must pass review before advancing to implement.
