---
id: 125
type: feature
status: in-progress
created: 2026-03-11T16:59:11.946Z
milestone: M0
priority: 2
---
# Consolidate plan-loop orchestration boundaries
Structural hardening issue.

The plan/review loop is currently spread across hooks, prompt injection, tools, state helpers, and workflow instructions. That fragmentation makes the workflow harder to reason about and likely contributes to the current whack-a-mole behavior seen in larger-work plan review.

## Goal
Create a clearer ownership boundary for plan-loop orchestration so draft, review, and revise behavior are easier to understand and evolve.

## Scope
- identify the current orchestration responsibilities split across modules
- define a clearer boundary for plan-loop coordination
- reduce scattered plan-loop logic where it materially improves maintainability
- preserve current external behavior unless an intentional cleanup is part of the change
- keep the refactor targeted to the plan workflow core

## Acceptance criteria
- plan-loop responsibilities have a clearer single ownership boundary
- the code path for draft → review → revise/approve is easier to trace
- behavior is covered by tests at the orchestration level
- the refactor reduces cross-module drift without becoming a broad architecture rewrite

## Notes
This issue is intentionally structural. It is meant to make the next round of plan-review improvements easier and safer, not to solve all convergence problems by itself.
