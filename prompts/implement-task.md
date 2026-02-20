You are implementing a single task from the plan. Follow strict Red-Green-Refactor TDD.

## Context
Issue: {{issue_slug}}
Phase: implement — Task {{current_task_index}} of {{total_tasks}}

## Execution Mode
You may work on this task inline or delegate to a subagent tool (if available).
- **Inline:** Work directly in this session. TDD is enforced via tdd-guard.
- **Subagent:** Delegate the task. TDD is enforced in the subagent's satellite session.
- Either way, signal task completion when done so megapowers can inspect and advance.

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
4. If it passes, the test is wrong — fix it before continuing

### GREEN — Write minimal code to pass
1. Write the smallest amount of code that makes the test pass
2. Run the test — confirm it passes
3. Run **all** tests — confirm nothing else broke

### REFACTOR — Clean up
1. Remove duplication, improve names, extract helpers
2. Keep tests green throughout
3. Do NOT add behavior during refactor

## Rules
- Work on **only the current task** — don't look ahead or refactor future tasks
- **No production code without a failing test first**
- If stuck, **stop and say so** — don't guess or force through
- Do not modify code unrelated to the current task

## When done, report:
- What was implemented (1-2 sentences)
- Files changed (list)
- Test results (actual output)
