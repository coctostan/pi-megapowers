## Goal
Add focused plan-review fan-out for larger plans by using the existing `pi-subagents` extension to run three advisory project agents in parallel: `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`. When a plan has 5 or more tasks, Megapowers should gather bounded review artifacts from those agents and feed them into the main plan review flow, while keeping final approve/revise authority in the main session and allowing review to proceed even if focused fan-out partially or fully fails.

## Acceptance Criteria
1. A project-scoped agent file exists at `.pi/agents/coverage-reviewer.md`.
2. `.pi/agents/coverage-reviewer.md` instructs the agent to analyze acceptance-criteria coverage against the current spec or diagnosis and current task files.
3. `.pi/agents/coverage-reviewer.md` instructs the agent to write its output to `.megapowers/plans/<issue-slug>/coverage-review.md`.
4. `.pi/agents/coverage-reviewer.md` defines a bounded output format with concrete AC-by-AC findings and task references.
5. `.pi/agents/coverage-reviewer.md` explicitly states that it is advisory only and does not own the final approve/revise decision.
6. A project-scoped agent file exists at `.pi/agents/dependency-reviewer.md`.
7. `.pi/agents/dependency-reviewer.md` instructs the agent to analyze task ordering, forward references, hidden prerequisites, unnecessary dependencies, and sequencing hazards.
8. `.pi/agents/dependency-reviewer.md` instructs the agent to write its output to `.megapowers/plans/<issue-slug>/dependency-review.md`.
9. `.pi/agents/dependency-reviewer.md` defines a bounded output format with concrete task-to-task findings.
10. `.pi/agents/dependency-reviewer.md` explicitly states that it is advisory only and does not own the final approve/revise decision.
11. A project-scoped agent file exists at `.pi/agents/task-quality-reviewer.md`.
12. `.pi/agents/task-quality-reviewer.md` instructs the agent to analyze task bodies for TDD completeness, realistic commands and errors, real file paths, correct APIs, and self-containment.
13. `.pi/agents/task-quality-reviewer.md` instructs the agent to write its output to `.megapowers/plans/<issue-slug>/task-quality-review.md`.
14. `.pi/agents/task-quality-reviewer.md` defines a bounded per-task output format with concrete findings tied to task steps, paths, or APIs.
15. `.pi/agents/task-quality-reviewer.md` explicitly states that it is advisory only and does not own the final approve/revise decision.
16. A pure gating helper returns `false` when the current plan has fewer than 5 tasks.
17. The same gating helper returns `true` when the current plan has 5 or more tasks.
18. When the current plan has fewer than 5 tasks, plan review does not invoke focused review fan-out.
19. When the current plan has 5 or more tasks, plan review invokes focused review fan-out with exactly these three agent names: `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`.
20. When focused review fan-out runs, it uses `pi-subagents` parallel execution rather than a Megapowers-specific subagent runtime.
21. When focused review fan-out runs, each focused reviewer receives the current issue context and the current plan inputs needed for its review.
22. When focused review fan-out runs, each focused reviewer is mapped to its expected artifact path under `.megapowers/plans/<issue-slug>/`.
23. When all three focused review artifacts are produced, the main plan review context includes all three artifacts before the final review verdict is generated.
24. When one or two focused review artifacts are missing or unavailable, the main plan review still proceeds and includes the available artifacts.
25. When all three focused review artifacts are missing or unavailable, the main plan review still proceeds without blocking on focused review.
26. When focused review fan-out partially fails, the user-facing main review output explicitly names which focused review artifacts were unavailable.
27. When focused review fan-out fully fails, the user-facing main review output explicitly states that focused review fan-out failed and that the review proceeded without advisory artifacts.
28. Focused review artifact availability does not change which session is allowed to call `megapowers_plan_review`.
29. The final approve/revise decision remains owned by the main plan review session even when focused review fan-out runs.
30. Existing plan review behavior is unchanged for plans that do not trigger focused review fan-out.

## Out of Scope
- Adding new workflow phases or changing plan-review authority boundaries.
- Making focused review mandatory for all plans.
- Using heuristics other than task count in v1.
- Adding retry budgets, resumable subagent runs, or a generic multi-agent orchestration framework.
- Blocking plan review when focused review artifacts are missing.
- Changing implementation-phase or code-review-phase subagent behavior.

## Open Questions
