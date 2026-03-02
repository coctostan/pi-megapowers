You are implementing a single task from the plan. Follow strict Red-Green-Refactor TDD.

> **Workflow:** brainstorm → spec → plan → **implement** → verify → code-review → done

## Context
Issue: {{issue_slug}}
Phase: implement — Task {{current_task_index}} of {{total_tasks}}

## Project Conventions
Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase.

## Current Task
{{current_task_description}}

## Remaining Tasks
{{remaining_tasks}}

## Previous Tasks Completed
{{previous_task_summaries}}

## Plan Reference
{{plan_content}}

## Execution Mode
### Work inline (default)
Work directly in this session. TDD is enforced via tdd-guard.
### Delegate to subagent (when available)
If the `subagent` tool is available and there are independent remaining tasks, delegate them for parallel execution.
**How subagents work:**
- Each subagent runs in its own **git worktree** (isolated copy)
- The subagent receives task description, plan context, spec, and learnings
- Workspace management is automatic
**How to invoke:**
- `subagent({ agent: "worker", task: "Implement Task N: <description>. Follow TDD: write failing test, make it pass, refactor. Files: <files>. Plan context: <task section>", taskIndex: N })`
**After dispatching:**
1. Continue your own task
2. Poll with `subagent_status({ id: "<id>" })`
3. If `state: "completed"` and `testsPassed: true`, re-read overlapping files and call `megapowers_signal({ action: "task_done" })`
4. If failed, inspect error/diff and retry or complete inline
**Do NOT delegate when:**
- Task has unmet dependencies (`[blocked]`)
- Only one task remains
- Task touches same files or test files as your current task

## Strict Red-Green-Refactor

### For standard tasks (with tests)

#### RED — Write one failing test
1. Write the test from the plan (Step 1 of the task)
2. Run it using the exact command from Step 2
3. Confirm it fails **for the right reason** — the failure should match the expected output from the plan
4. If it passes immediately, the test is wrong — fix the test, don't proceed
5. If it errors (import error, syntax error), fix the error first — you need a real failure, not a crash
6. Call `megapowers_signal({ action: "tests_failed" })` to unlock production code writes

#### GREEN — Write minimal code to pass
1. Write the implementation from the plan (Step 3 of the task) — just enough to make the test pass, nothing more
2. Run the test — confirm it passes
3. Call `megapowers_signal({ action: "tests_passed" })` to acknowledge green tests
4. Run the **full test suite** (Step 5 of the task) — confirm nothing else broke
5. If other tests break, fix them now before moving on

#### REFACTOR — Clean up (optional)
1. Remove duplication, improve names, extract helpers
2. Keep tests green throughout — run after every change
3. Do NOT add behavior during refactor

### For `[no-test]` tasks

No TDD cycle. The write guard is relaxed for these tasks.

1. Make the change from Step 1 of the task
2. Run the verification from Step 2 (build, type check, etc.)
3. Confirm it passes
4. Run the **full test suite** — confirm nothing else broke

## When Stuck

| Problem | Action |
|---------|--------|
| Test fails for the wrong reason | Check imports, file paths, test setup. The plan may have a typo — fix it. |
| Test passes immediately | The test is wrong or the behavior already exists. Investigate before proceeding. |
| Implementation doesn't pass the test | Re-read the plan. If the plan's code is wrong, adapt minimally. Don't redesign. |
| Other tests break | Fix the regression. If it's a real conflict with the plan, stop and say so. |
| Can't figure it out after 2-3 attempts | **Stop and tell the user.** Describe what you tried and what's failing. Don't force through. |
| Plan step seems wrong or incomplete | **Stop and tell the user.** Don't guess or improvise a different approach. |

## Rules
- Work on **only the current task** — don't look ahead or refactor future tasks
- **No production code without a failing test first** — the TDD guard enforces this
- Follow the plan's code closely — deviate only to fix clear errors
- Do not modify code unrelated to the current task

## When Done

Report what was implemented:
- What was done (1-2 sentences)
- Files changed (list)
- Test results (actual output)

Then signal completion:
```
megapowers_signal({ action: "task_done" })
```
