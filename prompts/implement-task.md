You are implementing a single task from the plan. Follow strict Red-Green-Refactor TDD.

## Context
Issue: {{issue_slug}}
Phase: implement — Task {{current_task_index}} of {{total_tasks}}

## Execution Mode

### Work inline (default)
Work directly in this session. TDD is enforced via tdd-guard.

### Delegate to subagent (when available)
If the `subagent` tool is available and there are independent remaining tasks, delegate them for parallel execution.

**When to delegate:** Delegate a task when it is marked `[ready — can be delegated to subagent]` in the remaining tasks list below. These tasks have no unmet dependencies and can run in parallel with your current work.

**How to invoke:**
```
subagent({ agent: "worker", task: "Implement Task N: <description>. Follow TDD: write failing test, make it pass, refactor. Files: <relevant files from plan>. Plan context: <paste relevant task section from plan>" })
```

**Do NOT delegate** when:
- The task depends on incomplete tasks (marked `[blocked]`)
- There is only one remaining task
- The task modifies the same files as your current task

Either way, signal task completion when done so megapowers can inspect and advance.

## Remaining Tasks
{{remaining_tasks}}

## Current Task
{{current_task_description}}

## Previous Tasks Completed
{{previous_task_summaries}}

## Plan Reference
{{plan_content}}

## Strict Red-Green-Refactor:

### RED — Write one failing test
1. Write the test from the plan
2. Run it
3. Confirm it fails **for the right reason** (missing feature, not typo/import error)
4. Call `megapowers_signal({ action: "tests_failed" })` to unlock production code writes
5. If it passes, the test is wrong — fix it before continuing

### GREEN — Write minimal code to pass
1. Write the smallest amount of code that makes the test pass
2. Run the test — confirm it passes
3. Call `megapowers_signal({ action: "tests_passed" })` to acknowledge green tests
4. Run **all** tests — confirm nothing else broke

### REFACTOR — Clean up
1. Remove duplication, improve names, extract helpers
2. Keep tests green throughout
3. Do NOT add behavior during refactor

## Type-Only Tasks

If the current task is purely type-level (e.g., adding a field to an interface, changing a type alias) and cannot produce a failing runtime test:
- If the task is annotated `[no-test]` in the plan, TDD is already bypassed — write the implementation directly.
- Otherwise, use the `/tdd skip` command to bypass the TDD guard for this task, then proceed with the implementation.

## Rules
- Work on **only the current task** — don't look ahead or refactor future tasks
- **No production code without a failing test first**
- If stuck, **stop and say so** — don't guess or force through
- Do not modify code unrelated to the current task

## When done, report:
- What was implemented (1-2 sentences)
- Files changed (list)
- Test results (actual output)
