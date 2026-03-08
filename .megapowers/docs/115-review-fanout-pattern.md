# Review fan-out planning pattern

## Goal
Capture the reusable project-level invocation pattern for focused plan review without pretending that saved markdown chains support parallel fan-out today.

## Pattern
Run these three project agents in parallel against the active planning artifact and current task files:
- `coverage-reviewer`
- `dependency-reviewer`
- `task-quality-reviewer`

## Inputs
- `.megapowers/plans/<issue-slug>/spec.md` for feature workflows or `.megapowers/plans/<issue-slug>/diagnosis.md` for bugfix workflows
- every current task file under `.megapowers/plans/<issue-slug>/tasks/`

## Bounded outputs
- `coverage-reviewer` writes `.megapowers/plans/<issue-slug>/coverage-review.md`
- `dependency-reviewer` writes `.megapowers/plans/<issue-slug>/dependency-review.md`
- `task-quality-reviewer` writes `.megapowers/plans/<issue-slug>/task-quality-review.md`

## Main-session ownership
- These outputs are advisory artifacts only.
- The main review session reads and synthesizes the focused review outputs.
- Final `megapowers_plan_review` submission remains in the main session.
- Subagents do not own workflow transitions or canonical plan state.

## Non-goals
- This pattern does not add new megapowers runtime orchestration.
- This pattern does not add saved parallel `.chain.md` support.
- This pattern does not replace the main session's final review authority.
