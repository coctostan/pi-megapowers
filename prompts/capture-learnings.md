You are capturing learnings from a completed issue. Review what happened during implementation and extract concise, reusable insights for future issues.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Instructions

Reflect on this issue and propose 2–5 learning entries. Each entry should be:
- **Specific** — not "testing is important" but "bun test requires `.js` extension in imports"
- **Actionable** — something a developer can act on next time
- **Concise** — one sentence per entry

Format your response as a markdown list. The user will review and approve before anything is saved.

## Example entries
- Rate limiter tests need a fake clock — real timers cause flaky failures
- The token service requires mocking via dependency injection, not module stubbing
- `bun test` runs all `.test.ts` files in the project root `tests/` dir by default
