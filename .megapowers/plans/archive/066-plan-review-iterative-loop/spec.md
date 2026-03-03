# Spec: Entity Parser + Plan Schemas

## Goal

Build a standalone data layer for structured plan representation: a generic frontmatter entity parser (gray-matter + zod), three plan-related schemas (task, summary, review), and a file I/O store for reading/writing them to disk under `.megapowers/plans/{issue-slug}/`. This ships as foundation infrastructure with no consumers yet — existing workflow code stays untouched.

## Acceptance Criteria

1. `parseFrontmatterEntity<T>(markdown, zodSchema)` parses valid frontmatter markdown and returns `{ success: true, data: T, content: string }` where `data` is the validated frontmatter and `content` is the markdown body.

2. `parseFrontmatterEntity` returns `{ success: false, errors: ParseError[] }` with `type: "yaml"` when the YAML frontmatter is malformed.

3. `parseFrontmatterEntity` returns `{ success: false, errors: ParseError[] }` with `type: "missing_frontmatter"` when the input has no frontmatter delimiters (`---`).

4. `parseFrontmatterEntity` returns `{ success: false, errors: ParseError[] }` with `type: "validation"` including `field` path and `message` when the frontmatter fails zod schema validation.

5. `serializeEntity(data, content, zodSchema)` produces a valid frontmatter markdown string that roundtrips through `parseFrontmatterEntity` to yield the original data and content.

6. `serializeEntity` validates `data` against the provided zod schema and throws on invalid input.

7. `PlanTaskSchema` validates frontmatter with required fields `id` (number), `title` (string), `status` (enum: `draft` | `approved` | `needs_revision`), and optional fields `depends_on` (number array, default `[]`), `no_test` (boolean, default `false`), `files_to_modify` (string array, default `[]`), `files_to_create` (string array, default `[]`).

8. `PlanTaskSchema` rejects documents where `status` is not one of `draft`, `approved`, or `needs_revision`.

9. `PlanSummarySchema` validates frontmatter with required fields `type` (literal `"plan"`), `issue` (string), `status` (enum: `draft` | `in_review` | `approved`), `iteration` (positive integer), `task_count` (non-negative integer).

10. `PlanReviewSchema` validates frontmatter with required fields `type` (literal `"plan-review"`), `iteration` (positive integer), `verdict` (enum: `approve` | `revise`), `reviewed_tasks` (number array), `approved_tasks` (number array), `needs_revision_tasks` (number array).

11. `writePlanTask(cwd, slug, task)` writes a task file to `.megapowers/plans/{slug}/tasks/task-{zero-padded id}.md`, creating directories as needed.

12. `readPlanTask(cwd, slug, id)` returns the parsed task or `null` when the file does not exist.

13. `listPlanTasks(cwd, slug)` returns all tasks sorted by `id`, or an empty array when the directory does not exist.

14. `listPlanTasks` returns an error when two task files contain the same `id` in their frontmatter.

15. `writePlanSummary(cwd, slug, summary)` writes to `.megapowers/plans/{slug}/plan.md`, creating directories as needed.

16. `readPlanSummary(cwd, slug)` returns the parsed summary or `null` when the file does not exist.

17. `writePlanReview(cwd, slug, review)` writes to `.megapowers/plans/{slug}/review.md`, creating directories as needed.

18. `readPlanReview(cwd, slug)` returns the parsed review or `null` when the file does not exist.

19. Writing a single task via `writePlanTask` does not modify other existing task files in the same plan directory.

20. Task ID gaps are allowed — `listPlanTasks` for a directory containing `task-01.md` and `task-03.md` (no `task-02.md`) returns both tasks sorted by ID without error.

21. All store read functions return `null` or empty array (not throw) when the plan directory doesn't exist. All store write functions create the directory tree if it doesn't exist.

22. `ParseError` includes `type` (`"yaml"` | `"missing_frontmatter"` | `"validation"`), and for validation errors also includes `field` (string path) and `message`.

## Out of Scope

- Modifying existing `plan-parser.ts`, `derived.ts`, workflow signals, or prompt files
- Plan-review loop state machine (`planMode` in `state.json`, mode transitions, prompt selection)
- `megapowers_plan_task` tool registration or any new custom tools
- Migration of `getTasks()` / `currentTaskIndex` from plan-parser to plan-store
- Per-phase model or context switching
- Iteration caps or any config additions
- Any integration with the existing megapowers workflow — this is purely new standalone code

## Open Questions

_(none)_
