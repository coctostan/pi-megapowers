You are writing a step-by-step implementation plan from a spec. Each task maps 1:1 to a test. A developer with zero context about this codebase should be able to execute any task from this plan alone.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Brainstorm Notes
{{brainstorm_content}}

## Instructions

For each task:
- Use `### Task N: Title` format
- List **exact file paths**: what to create, modify, test
- Include **complete code** — no "implement something similar" or "add validation"
- Specify the **test that verifies it** with full test code
- Follow **TDD sequence**: write test → verify it fails → implement → verify it passes
- Note **what previous tasks provide** if there are dependencies

### Task structure:

```
### Task N: [Name] [depends: 1, 2]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

**Test:** [Full test code]

**Implementation:** [Full implementation code]

**Verify:** [Exact command to run]
```

## Rules
- Tasks must be **independently verifiable** — if a task has "and" in it, split it
- Task order must **respect dependencies** — foundational pieces first
- **Annotate dependencies** — if a task requires output from prior tasks, add `[depends: N, M]` to the title (e.g., `### Task 3: Integration [depends: 1, 2]`). Omit for tasks with no dependencies.
- **YAGNI** — no tasks for speculative features
- **DRY** — extract shared code into utilities, don't duplicate
- **Type-only tasks** (interface changes, type aliases, `.d.ts` edits) that cannot produce a failing runtime test must be annotated with `[no-test]` in the task title (e.g., `### Task 3: Add phase field to State interface [no-test]`). This bypasses TDD enforcement for that task.
- Each acceptance criterion from the spec should be covered by at least one task

## Project Learnings
{{learnings}}

## Roadmap Context
{{roadmap}}
