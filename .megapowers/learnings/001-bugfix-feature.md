# Learnings — 001-bugfix-feature

## Implementation

1. **Aliasing variables works well for workflow variants**: Rather than duplicating templates, mapping `reproduce_content → brainstorm_content` lets the plan template work for both feature and bugfix without changes.

2. **Always set state unconditionally on extraction**: The stale criteria bug (`if (criteria.length > 0)`) is a pattern to avoid. When extracting state from output, always write the result — including empty — to prevent stale data persisting from previous iterations.

3. **Integration tests catch glue code regressions**: Unit tests for individual modules (parser, gates, router) don't catch wiring bugs in `index.ts`. Template interpolation integration tests are cheap and high-value.

## Process

4. **Phase resume is broken**: When all implement tasks are done and a session resumes, the system has no mechanism to detect completion and advance to verify. Template placeholders pass through uninterpolated. Filed as issue 003.

5. **Code review subagent catches real bugs**: The stale criteria issue was found by the code review subagent, not during implementation. This validates the code-review phase as more than ceremony.

6. **Plan task state must be populated on transition**: `planTasks: []` in state after plan→implement means the task coordinator can't track progress. This is a prerequisite for fixing issue 003.
