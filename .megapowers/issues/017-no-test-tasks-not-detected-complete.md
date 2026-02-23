---
id: 17
type: bugfix
status: open
created: 2026-02-23T04:24:00.000Z
---

# [no-test] tasks silently fail to be marked complete

## Problem

When a plan task is marked `[no-test]` and the work was already done in a prior issue/session (e.g. a field already exists on an interface), the LLM naturally responds with "nothing to do, already exists" and provides a summary. Megapowers does **not** detect this as task completion, leaving all tasks showing as incomplete (0/N done).

The completion detection regex in `artifact-router.ts` requires one of these patterns in the assistant message:

```
/(?:task\s+(?:complete|done|finished)|##?\s*(?:what was implemented|checkpoint))/i
```

But the LLM doesn't naturally produce those exact phrases when there's nothing to implement. Even when explicitly coached to say "task complete", it took 3 attempts before megapowers recognized the completion — the phrase needs to appear in the same assistant turn that megapowers processes, and the LLM kept providing it in a conversational way that didn't match.

## Reproduction

1. Create a plan with a `[no-test]` task that modifies a file where the change already exists
2. Enter implement phase — megapowers assigns Task 1
3. LLM reads the file, sees the change is already there, reports "nothing needed"
4. megapowers processes the message but doesn't detect completion
5. User says "trigger megapowers" — still 0/5 tasks complete
6. Even adding a JSDoc comment to force a file write doesn't help — the completion regex still needs to match

## Root Cause

The completion detection is purely regex-based on assistant message text. There's no fallback for:
- Tasks where the LLM confirms work is already done
- Tasks where the LLM makes a trivial change and reports it without using the magic phrases
- `[no-test]` tasks that bypass TDD guard but still need the same completion signal

## Expected Behavior

When the LLM reports that a `[no-test]` task requires no changes (or minimal changes) and confirms it's done, megapowers should detect that and advance to the next task.

## Possible Fixes

1. **Broaden the completion regex** — add patterns like `no changes needed`, `already exists`, `nothing to implement`, `already present`
2. **Auto-complete `[no-test]` tasks** that the LLM confirms are already done (detect "already exists" + task context)
3. **Add an explicit completion command** — e.g. `/task done` that the LLM or user can invoke to force-mark the current task complete
4. **Make the implement-task prompt more explicit** — tell the LLM it MUST end with the exact phrase "Task complete." (current prompt says "signal task completion" but doesn't specify the exact phrase)

Option 3 or 4 seems most robust — a deterministic signal rather than more regex heuristics.
