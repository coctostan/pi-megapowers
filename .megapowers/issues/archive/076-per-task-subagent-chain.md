---
id: 76
type: feature
status: done
created: 2026-02-25T18:50:00.000Z
milestone: M2
priority: 4
---

# Per-Task Subagent Chain

## Problem

Currently, task delegation is one-shot: delegate a task to one subagent, get result, move on. The implement → verify → code-review cycle for each task is done by the parent agent or manually. There's no automated pipeline where a task flows through implementation, verification, and review as separate delegated steps.

## Proposed Solution

For each plan task, run a chain of subagents with different roles:

1. **Implementer** — writes code + tests for the task
2. **Verifier** — runs tests, checks acceptance criteria, validates
3. **Reviewer** — code review, style, correctness

Each step gets a role-specific prompt. If verifier fails, loop back to implementer with failure context. If reviewer rejects, loop back with review feedback.

```
for each task:
  implement → verify → [pass? → review → [approve? → next task]]
                         [fail? → re-implement with context]
```

Configurable: user can set chain depth (implement-only, implement+verify, full chain).

## Acceptance Criteria

- [ ] Task chain executes implement → verify → review per task
- [ ] Each chain step uses role-specific prompt
- [ ] Verify failure loops back to implement with failure context
- [ ] Review rejection loops back to implement with review feedback
- [ ] Chain depth configurable (1-step, 2-step, 3-step)
- [ ] Results from each step feed into next step's context
- [ ] Parent agent orchestrates chain, doesn't do the work

## Notes

- Depends on #074 (structured handoff) — chain decisions need structured results.
- Depends on #067 (squash) — each step's work must survive.
- This is the most ambitious M2 feature. Could be split further during planning.
- Maximum loop iterations should be capped (e.g., 3 implement attempts before escalating to parent).
