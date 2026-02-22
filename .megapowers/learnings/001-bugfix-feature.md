# Learnings — 001-bugfix-feature

## Implementation

1. **Aliasing variables works well for workflow variants**: Rather than duplicating templates, mapping `reproduce_content → brainstorm_content` lets the plan template work for both feature and bugfix without changes.

2. **Always set state unconditionally on extraction**: The stale criteria bug (`if (criteria.length > 0)`) is a pattern to avoid. When extracting state from output, always write the result — including empty — to prevent stale data persisting from previous iterations.

3. **Integration tests catch glue code regressions**: Unit tests for individual modules (parser, gates, router) don't catch wiring bugs in `index.ts`. Template interpolation integration tests are cheap and high-value.

4. **Extract shared helpers when patterns duplicate across workflows**: `extractAcceptanceCriteria` and `extractFixedWhenCriteria` were copy-pasted with only the heading regex changed. Refactored to `extractNumberedSection(content, headingPattern)` during code review — should have been caught during implementation.

## Process

5. **Phase resume is broken**: When all implement tasks are done and a session resumes, the system has no mechanism to detect completion and advance to verify. Template placeholders pass through uninterpolated. Filed as issue 003.

6. **Code review subagent catches real bugs**: The stale criteria issue was found by the code review subagent, not during implementation. This validates the code-review phase as more than ceremony.

7. **Plan task state must be populated on transition**: `planTasks: []` in state after plan→implement means the task coordinator can't track progress. This is a prerequisite for fixing issue 003.

8. **session_shutdown overwrites advanced file state**: The in-memory state is stale relative to the file when tasks complete across sessions. The `session_shutdown` handler saves in-memory state unconditionally, clobbering any file-level advances. A phase-ordering guard was added as a mitigation but is a heuristic — a proper fix needs timestamp-based or version-based state comparison. Filed as issue 004.

9. **Don't offer phase transitions during implement until all tasks done**: The `handlePhaseTransition` menu fires after every task completion even when tasks remain, showing a confusing "Cannot advance" error. The transition offer should be gated on `allTasksDone` during implement phase. (Not yet fixed — blocked by TDD guard during code-review session.)
