## Goal
Add a minimally useful, project-scoped planning scout that uses the external pi-subagents extension to produce a bounded `context.md` handoff before plan drafting. The scout should reduce planning-session context overload by summarizing acceptance-criteria mapping, relevant files, conventions, risks, and likely task slices, while keeping all megapowers authority in the main session and documenting the experiment boundaries for future planning/review/revise subagent work.

## Acceptance Criteria
1. A new project agent file exists at `.pi/agents/plan-scout.md` with valid frontmatter that identifies it as a planning-specific scout agent.

2. `.pi/agents/plan-scout.md` instructs the scout to read the active planning artifact (`spec.md` for feature workflows or `diagnosis.md` for bugfix workflows) before performing repo scouting.

3. `.pi/agents/plan-scout.md` instructs the scout to stop and report missing required input when neither `spec.md` nor `diagnosis.md` is available.

4. `.pi/agents/plan-scout.md` defines the scout as advisory-only and explicitly forbids it from writing plan tasks, calling megapowers workflow-transition tools, or claiming plan review authority.

5. `.pi/agents/plan-scout.md` defines a bounded output contract for `.megapowers/plans/<issue-slug>/context.md` that includes acceptance-criteria or fixed-when mapping, key file paths, existing APIs/tests/conventions, risks, and suggested task slices.

6. A written design or experiment artifact exists in the repository that explains that `context.md` is a planning handoff consumed by the main planning session and is not canonical workflow state.

7. The design or experiment artifact defines at least one draft-assist pattern that uses `plan-scout` and at least one review-fanout pattern for future planning review decomposition.

8. The design or experiment artifact explicitly states that planning subagents are advisory only and that implementation delegation is out of scope.

9. The design or experiment artifact defines concrete success criteria for the planning-subagent experiment, including reduced context overload and improved review/revise clarity.

10. Repository guidance that broadly says `subagent` or `pipeline` tools are broken is removed, narrowed, or clarified so it does not contradict the new advisory planning-scout workflow.

## Out of Scope
- Adding review/revise subagent families in this issue
- Adding new megapowers runtime orchestration for planning subagents
- End-to-end automated execution tests that invoke real external subagents
- Making `context.md` canonical state for planning or review
- Allowing planning subagents to create tasks, submit reviews, or transition workflow state
- Changing implementation-pipeline behavior beyond clarifying conflicting guidance

## Open Questions
