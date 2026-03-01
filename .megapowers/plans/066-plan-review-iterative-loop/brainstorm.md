# Brainstorm: Entity Parser + Plan Schemas

## Problem

The current plan-review cycle doesn't converge. Plans are monolithic markdown blobs parsed by regex. Reviewers see the whole plan or nothing. When review rejects, the planner restarts from scratch with no structured feedback. This is the foundation issue — before fixing the loop, we need structured plan data.

## Approach

Build a standalone data layer: a generic frontmatter entity parser using gray-matter + zod, three plan-related schemas (task, summary, review), and a file I/O store for reading/writing them to disk. This ships as a foundation with no consumers yet — nothing in the existing megapowers workflow changes. The old `plan-parser.ts` stays in place untouched.

The entity parser is built generically (`parseFrontmatterEntity<T>(markdown, zodSchema)`) so it can be reused for any future frontmatter-based entity (issues, specs, etc.). All markdown files going forward will use frontmatter. But for this issue, it's only used by plan tasks, plan summaries, and plan reviews.

Error handling uses result types (`ParseResult<T>`), not exceptions. Parse failures return structured errors with field paths and error types. File I/O failures on reads return null/empty (not found is not an error); writes create directories as needed; OS-level errors propagate.

## Key Decisions

- **gray-matter + zod** — gray-matter handles YAML frontmatter extraction, zod handles typed schema validation. Both are well-maintained, small, and testable.
- **Result types, not exceptions** — consumers need to make decisions based on parse failures, not catch-and-hope.
- **Per-task files** — tasks live as individual files (`task-01.md`, `task-02.md`) under `.megapowers/plans/{issue-slug}/tasks/`, not in a monolithic plan.md. Enables per-task review granularity in the follow-up.
- **Plan summary is frontmattered** — `plan.md` becomes a frontmattered overview document alongside the task files.
- **Review is its own file** — `review.md` contains the reviewer's verdict and per-task feedback, with structured frontmatter listing approved/needs_revision task IDs.
- **Existing code untouched** — `plan-parser.ts`, `derived.ts`, workflows, signals, prompts all stay as-is. Zero breaking changes.
- **Duplicate task ID detection** — store validates uniqueness on list. Task ID gaps are allowed (IDs are identifiers, not indices).

## Schemas

### PlanTask (`tasks/task-01.md`)
```yaml
---
id: 1
title: "Build entity parser"
status: draft              # draft | approved | needs_revision
depends_on: []             # task IDs
no_test: false
files_to_modify: []
files_to_create: []
---
## Description
...
## Test Strategy
...
## Acceptance Criteria
- [ ] ...
```

### PlanSummary (`plan.md`)
```yaml
---
type: plan
issue: "066-plan-review-iterative-loop"
status: draft              # draft | in_review | approved
iteration: 1
task_count: 5
---
## Approach
...
```

### PlanReview (`review.md`)
```yaml
---
type: plan-review
iteration: 1
verdict: revise            # approve | revise
reviewed_tasks: [1, 2, 3, 4, 5]
approved_tasks: [1, 3, 5]
needs_revision_tasks: [2, 4]
---
## Summary
...
## Task 2 — Needs Revision
...
## Task 1 — Approved
...
```

### Directory Structure
```
.megapowers/plans/{issue-slug}/
  plan.md              # frontmattered summary
  review.md            # latest review verdict + feedback
  tasks/
    task-01.md
    task-02.md
    ...
```

## Components

1. **`entity-parser.ts`** — `parseFrontmatterEntity<T>(markdown, zodSchema)` → `ParseResult<T>`. Also `serializeEntity(data, content, zodSchema)` → markdown string. Wraps gray-matter for extraction, zod for validation.

2. **`plan-schemas.ts`** — Zod schema definitions: `PlanTaskSchema`, `PlanSummarySchema`, `PlanReviewSchema`. Enums for status/verdict fields.

3. **`plan-store.ts`** — File I/O layer. Functions: `writePlanTask(cwd, slug, task)`, `readPlanTask(cwd, slug, id)`, `listPlanTasks(cwd, slug)`, `writePlanSummary(cwd, slug, summary)`, `readPlanSummary(cwd, slug)`, `writePlanReview(cwd, slug, review)`, `readPlanReview(cwd, slug)`. Uses entity-parser internally.

## Error Handling

- **Malformed YAML** — gray-matter error caught, returned as `ParseError` with `type: "yaml"`
- **Schema validation failure** — zod errors mapped to `ParseError` with `type: "validation"`, field path, expected/received
- **No frontmatter delimiter** — detected, returned as `ParseError` with `type: "missing_frontmatter"`
- **Directory not found on read** — return empty array / null, not an error
- **Directory not found on write** — create it (mkdirp)
- **Duplicate task IDs** — detected at store level, returned as error
- **Task ID gaps** — allowed, not an error
- **OS-level errors** (permissions, disk) — propagate, unrecoverable

## Testing Strategy

**`entity-parser.test.ts`:** Valid parse + roundtrip, missing required fields, wrong types, extra fields, malformed YAML, no frontmatter, empty body, null optional fields with defaults.

**`plan-schemas.test.ts`:** Each schema validates correct input, rejects invalid enum values, handles defaults (no_test → false), array type enforcement.

**`plan-store.test.ts`:** Write → read roundtrip, list returns sorted by ID, directory auto-creation, nonexistent directory reads, update single task leaves others untouched, duplicate ID detection.

All tests pure, no pi dependency, temp directories for file I/O.

## Deferred to Follow-Up Issues

### Plan-Review Loop (wires in this data layer)
- `planMode` state (draft/review/revise) added to `state.json`
- Automatic mode transitions on artifact save
- `newSession()` on each mode transition for clean context
- Prompt selection per mode (write-plan.md / review-plan.md / revise-plan.md)
- Remove `review` as separate workflow phase
- `review_approve` signal disposition
- `megapowers_plan_task` tool registration
- `getTasks()` / `currentTaskIndex` migration from plan-parser to plan-store
- Iteration cap (`maxPlanIterations` config, default 3)

### Per-Phase Model/Context Switching
- `.megapowers/config.json` with per-phase model/thinking settings
- Automatic model switch on mode transitions
- Model restore after review loop exits
- Initially, users manually switch via `/model` command

### Open Design Questions (for follow-up brainstorms)
1. How does the agent save tasks — one tool call per task? Batch? What triggers "done drafting"?
2. How does the reviewer interact — per-task verdicts via tool calls? When is review "complete"?
3. Plan summary timing — before or after tasks?
4. Review isolation — revise prompt only surfaces needs_revision tasks?
5. `review_approve` signal — dead code or repurposed?
