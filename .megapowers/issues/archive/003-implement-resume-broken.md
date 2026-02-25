---
title: "Implement phase resume doesn't detect completion"
type: bugfix
status: done
created: 2026-02-22
---

# Implement phase resume doesn't detect completion

## Bug Description

When resuming a session during the `implement` phase after all tasks are already complete, the agent cannot determine that implementation is done and should advance to `verify`. It gets stuck in implement mode and has to manually audit every AC to figure out nothing remains.

## Symptoms

1. **Uninterpolated template variables**: The system prompt contains raw `{{current_task_index}}`, `{{current_task_description}}`, and `{{previous_task_summaries}}` — none were replaced with actual values.
2. **Empty `planTasks` in state**: `state.planTasks` is `[]` despite 8 tasks existing in `plan.md`. The plan was never parsed into state, or was cleared.
3. **`currentTaskIndex` stuck at 0**: With no plan tasks tracked, the index was never advanced.
4. **No "all tasks done" detection**: The implement prompt template has no branch for "all tasks complete → advance to verify". The agent is always told it's implementing a task, even when there are none left.

## Root Causes (suspected)

- **Plan tasks not loaded into state**: When transitioning `plan → implement` (or `review → implement`), `planTasks` should be populated from `plan.md` via `plan-parser.ts`. Either the transition doesn't trigger parsing, or parsing results aren't persisted.
- **Template interpolation failure**: `prompts.ts` or `index.ts` doesn't interpolate the implement-task template variables when `planTasks` is empty or `currentTaskIndex` is out of bounds — it silently leaves `{{...}}` placeholders in the output.
- **No completion guard**: There's no gate or prompt branch that says "all tasks done, transition to verify". The implement phase assumes there's always a current task.

## Expected Behavior

When all plan tasks are complete (or `currentTaskIndex >= planTasks.length`):
- The agent should NOT receive an "implement task N" prompt
- The system should either auto-advance to `verify` or prompt the agent to do so
- Template variables should never appear uninterpolated in agent-visible text

## Observed Behavior

Agent receives a system prompt with raw `{{...}}` placeholders, has no task to work on, and must manually audit the entire codebase to determine all work is done. No mechanism exists to advance to verify.

## Impact

Any multi-task implementation that completes all tasks and then resumes (new session, crash recovery, etc.) will get stuck in this state. The agent wastes a full context window re-auditing work that's already done.
