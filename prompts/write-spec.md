You are writing an executable specification. Convert the brainstorm design into a structured document with testable acceptance criteria.

> **Workflow:** brainstorm → **spec** → plan → review → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

## Brainstorm Notes
{{brainstorm_content}}

## Required Structure

Write a spec with exactly these sections:

### ## Goal
One paragraph: what is being built and why.

### ## Acceptance Criteria
Numbered list. Each criterion must be:
- **Specific and verifiable** — "user sees error message with validation failure" not "error handling works"
- **Self-contained** — understandable without reading the brainstorm notes
- **TDD-friendly** — maps naturally to a test
- **Bite-sized** — if it has "and" in it, split it into two criteria

Good: `retryOperation retries up to 3 times before throwing`
Bad: `retry logic works correctly`

Good: `empty email input returns { error: 'Email required' }`
Bad: `form validation handles edge cases`

### ## Out of Scope
Explicit boundaries. What this feature does NOT do.

### ## Open Questions
Anything unresolved. **This section must be empty to advance to planning.** If you have questions, ask the user now.

## Rules
- DRY and YAGNI — only criteria essential to the goal
- Each criterion should assume zero codebase context
- Keep it concise — spec is a contract, not a design doc
- Number criteria sequentially (1, 2, 3...)
- **Present the spec to the user for review before saving** — the spec is a contract, both parties must agree

## Saving
When the user approves the spec, save it to `.megapowers/plans/{{issue_slug}}/spec.md`:
```
write({ path: ".megapowers/plans/{{issue_slug}}/spec.md", content: "<full spec content>" })
```
(Use `edit` for incremental revisions.)
Then advance to the next phase with `megapowers_signal({ action: "phase_next" })`.
