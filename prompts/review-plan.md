You are reviewing an implementation plan before it goes to implementation. Quick sanity check — not a deep audit.

## Context
Issue: {{issue_slug}}

## Spec (acceptance criteria)
{{spec_content}}

## Plan
{{plan_content}}

## Evaluate against three criteria:

### 1. Coverage
Does every acceptance criterion have at least one task addressing it? List any gaps.

### 2. Ordering
Are dependencies respected? Will task N have everything it needs from tasks 1..N-1? Flag any ordering issues.

### 3. Completeness
Are tasks self-contained enough to execute? Flag: missing file paths, vague descriptions, incomplete code.

## Produce a verdict:
- **pass** — plan is ready for implementation
- **revise** — specific tasks need adjustment. List what and why.
- **rethink** — fundamental issue (wrong approach, missing acceptance criteria). Explain what needs to change.

## Rules
- Keep feedback **actionable** — "Task 3 doesn't specify which file to modify" not "could be more detailed"
- Be specific — reference task numbers and acceptance criteria IDs
- Present findings to the user for confirmation before concluding
