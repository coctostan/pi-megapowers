---
id: 56
type: feature
status: open
created: 2026-02-24T19:40:00.000Z
---

# Iterative plan-review cycle with file versioning and automation

## Problem

The plan → review → plan loop is clunky and manual. When review feedback requires plan revisions:

1. **File versioning is messy** — review feedback accumulates as separate files (`review.md`, `review-feedback-round2.md`, `review-feedback-round4.md`) with no clear relationship to which version of the plan they refer to. The plan itself gets overwritten with no history of what changed between rounds.

2. **The cycle isn't automated** — the user has to manually shepherd each round: read review, tell the agent to revise the plan, tell it to go back to review, read the next review, repeat. There's no structured loop that drives toward convergence.

3. **Round tracking is invisible** — there's no way to see which review round you're on, what changed since last round, or whether the review addressed previous feedback. The agent sometimes re-introduces issues that were already flagged.

## Desired Behavior

### File versioning
- **Plan versions**: When the plan is revised, save the previous version (e.g., `plan-v1.md`, `plan-v2.md`) rather than overwriting. The current version is always `plan.md` but history is preserved.
- **Review-to-plan linking**: Each review artifact should reference which plan version it reviewed. Each plan revision should reference which review feedback it addressed.
- **Diff visibility**: When presenting a revised plan for review, highlight or summarize what changed from the previous version — don't make the reviewer re-read the entire plan.

### Automated iteration
- **Review round counter**: Track which round of review we're on in state or derived from artifact count.
- **Structured feedback format**: Reviews should produce structured output (blocking issues, suggestions, approved items) so the plan phase knows exactly what to fix.
- **Auto-advance loop**: After plan revision, automatically advance to review. After review approval, automatically advance to implement. The user only intervenes when the review rejects.
- **Convergence detection**: If the same feedback appears across multiple rounds, flag it. If review keeps bouncing, surface it to the user rather than looping forever.
- **Max rounds**: Configurable cap on review rounds (e.g., 4) before escalating to the user.

### Integration with existing workflow
- The `review → plan` backward transition already exists in the state machine
- `reviewApproved` state field already gates `review → implement`
- `megapowers_signal` with `review_approve` already handles approval
- This should build on those primitives, not replace them

## Context

- In #032, the plan went through 4 review rounds manually — each round produced a separate review file and the plan was rewritten in place
- The agent has no memory of previous review feedback unless it's in the conversation context (which may be stale — see #054)
- Subagent reviewers (#055) could run review rounds, but they'd need the same versioned artifacts to be effective
