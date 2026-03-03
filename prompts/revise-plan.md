You are revising a plan based on reviewer feedback.

> **Workflow:** brainstorm → spec → **plan (revise)** → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

Read the latest review artifact in `.megapowers/plans/{{issue_slug}}/` for detailed per-task feedback.

## Instructions

1. Read the review feedback from the review artifact file
2. Read task files in `.megapowers/plans/{{issue_slug}}/tasks/`
3. Fix **only** the tasks marked `needs_revision`. Don't touch `approved` tasks unless the reviewer explicitly said to.
4. For each revised task, check it against the rejection reason — don't just tweak wording, fix the actual problem.

For frontmatter/task metadata updates, use:
```
megapowers_plan_task({ id: N, depends_on: [1, 2], files_to_modify: [...] })
```

**For body changes** (implementation details, test code):
Use `read` + `edit` to make surgical changes to existing task files.

## Every Revised Task Must Have This Structure

Non-`[no-test]` tasks need all 5 steps — no exceptions, no shortcuts:

- **Step 1 — Write the failing test.** Full, copy-pasteable test code. Not pseudocode, not "similar to Task 3", not a description of what to test — the actual test.
- **Step 2 — Run test, verify it fails.** Exact run command + the specific error message the runner will print (e.g. "TypeError: processEvent is not a function", not just "FAIL").
- **Step 3 — Write minimal implementation.** Full, copy-pasteable code. Just enough to make the test pass. No "add validation logic here" or "implement the handler".
- **Step 4 — Run test, verify it passes.** Same command as Step 2. Expected: PASS.
- **Step 5 — Verify no regressions.** Full test suite command. Expected: all passing.

If a step is missing or incomplete in the task you're revising, **add it with complete code** — that's likely why it was rejected.

## Granularity

If the reviewer said a task is too big or tests multiple behaviors, split it. But each new task must be **fully independent**:

- Its own complete test code (not "see Task N")
- Its own complete implementation code
- Its own file paths listed
- One test, one behavior — if you're asserting two different things, that's two tasks

## Most Common Revision Failures

Revisions get rejected again when they fix the surface complaint but not the root cause:

| ❌ What you did | ✅ What you should have done |
|---|---|
| Reviewer said "add specific error" → you wrote "Expected: FAIL — test fails" | Write the actual error: "Expected: FAIL — TypeError: x is not a function" |
| Reviewer said "split this task" → second half says "similar to above" | Each split task has its own full test + implementation code |
| Reviewer said "missing coverage" → you added a task with just a description | Write the full 5-step TDD task with real code |
| Reviewer said "incomplete Step 3" → you added a comment placeholder | Write the actual implementation code |
| Reviewer said "Step 1 is pseudocode" → you expanded the description | Replace the description with copy-pasteable test code |

## When Done

After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
Do not use direct phase-advance actions here — the plan must pass review before advancing to implement.
