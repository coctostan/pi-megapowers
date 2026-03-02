You are capturing learnings from a completed issue. Review what happened during implementation and extract concise, reusable insights for future issues.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

> **Bugfix note:** In bugfix workflows, "Spec" above is the **diagnosis** and verification includes the original bug reproduction check.

## Instructions

Reflect on this issue and propose 2–5 learning entries. Each entry should be:
- **Specific** — not "testing is important" but "the token service requires dependency injection for mocking, module stubbing doesn't work"
- **Actionable** — something a developer can act on next time
- **Concise** — one sentence per entry
- **Project-scoped** — relevant to this codebase, not generic advice

Focus on:
- What surprised you during implementation?
- What took longer than expected and why?
- What patterns or techniques worked well?
- What gotchas would trip up someone unfamiliar with this code?

## Example entries
- Rate limiter tests need a fake clock — real timers cause flaky failures
- The token service requires mocking via dependency injection, not module stubbing
- Write policy tests must cover both `canWrite()` pure function and `evaluateWriteOverride()` integration
- When consolidating worktree changes, apply the patch before removing the worktree — order matters

Format your response as a markdown list. Present the learnings to the user for review. When they approve (or edit), save them to `.megapowers/plans/{{issue_slug}}/learnings.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/learnings.md", content: "<approved markdown list>" })
```
(Use `edit` for incremental revisions.)
