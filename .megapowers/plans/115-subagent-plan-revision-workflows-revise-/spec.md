## Goal
Add a thin, reusable planning-support layer that improves targeted plan revision and draft assistance without adding new megapowers runtime behavior. This feature adds a project-scoped `revise-helper` advisory agent for narrow revise sessions, a project-scoped sequential `draft-assist` chain for the supported `plan-scout -> planner` workflow, and a documented reusable review-fanout pattern for focused plan review, while keeping canonical task edits, final plan review submission, and workflow transitions in the main session.

## Acceptance Criteria
1. A project agent file exists at `.pi/agents/revise-helper.md`.
2. `.pi/agents/revise-helper.md` instructs the agent to read the latest `revise-instructions-N.md`.
3. `.pi/agents/revise-helper.md` instructs the agent to read only the affected `tasks/task-NNN.md` files by default.
4. `.pi/agents/revise-helper.md` instructs the agent not to rewrite unaffected tasks.
5. `.pi/agents/revise-helper.md` instructs the agent to write an advisory artifact named `revise-proposal.md`.
6. `.pi/agents/revise-helper.md` defines an output format that includes task-local replacements or edit snippets.
7. `.pi/agents/revise-helper.md` defines an output format that includes a short global sanity check for coverage or dependency fallout.
8. `.pi/agents/revise-helper.md` states that prior review artifacts must not be read unless the revise instructions reference a coverage or dependency concern or name those artifacts directly.
9. `.pi/agents/revise-helper.md` states that the main session performs the actual task edits and resubmission.
10. `.pi/agents/revise-helper.md` states that the agent is advisory only.
11. `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_plan_task`.
12. `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_plan_review`.
13. `.pi/agents/revise-helper.md` does not instruct the agent to call `megapowers_signal`.
14. A project chain file exists at `.pi/agents/draft-assist.chain.md`.
15. `.pi/agents/draft-assist.chain.md` has chain frontmatter with both `name` and `description`.
16. `.pi/agents/draft-assist.chain.md` defines a `plan-scout` step.
17. `.pi/agents/draft-assist.chain.md` defines a later planner step that consumes scout output.
18. `.pi/agents/draft-assist.chain.md` uses the bounded artifact name `context.md`.
19. `.pi/agents/draft-assist.chain.md` describes an advisory planning flow only.
20. `.pi/agents/draft-assist.chain.md` does not instruct any step to create canonical plan task files.
21. `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_plan_task`.
22. `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_plan_review`.
23. `.pi/agents/draft-assist.chain.md` does not instruct any step to call `megapowers_signal`.
24. A project documentation file exists under `.megapowers/docs/` that describes the reusable review-fanout planning pattern.
25. The review-fanout documentation names `coverage-reviewer`, `dependency-reviewer`, and `task-quality-reviewer`.
26. The review-fanout documentation names the bounded artifacts `coverage-review.md`, `dependency-review.md`, and `task-quality-review.md`.
27. The review-fanout documentation states that the review-fanout outputs are advisory artifacts.
28. The review-fanout documentation states that the main review session synthesizes the focused review outputs.
29. The review-fanout documentation states that final `megapowers_plan_review` submission remains in the main session.

## Out of Scope
- Adding new megapowers runtime orchestration for draft assist, revise assist, or review fan-out.
- Adding saved parallel `.chain.md` support to `pi-subagents`.
- Changing the existing focused review runtime implementation.
- Allowing subagents to edit canonical task state directly.
- Allowing subagents to own workflow transitions or final plan review decisions.

## Open Questions
