# Spec: Plan-Review Iterative Loop Wiring

## Goal

Replace the split `plan` + `review` workflow phases with a single `plan` phase containing an internal draft/review/revise loop. Two new tools (`megapowers_plan_task` and `megapowers_plan_review`) handle structured data flow via typed params — no regex parsing on the write path. Each mode transition (`draft` → `review` → `revise`) triggers `newSession()` to eliminate role bias. On approval, a backward-compatible `plan.md` is generated from task files so all downstream consumers continue working without changes. The `review` phase is removed from both feature and bugfix workflow configs. This issue wires the #066 data layer (entity-parser, plan-schemas, plan-store) into production — those modules currently have zero consumers.

## Acceptance Criteria

**State machine**

1. `MegapowersState` includes `planMode: "draft" | "review" | "revise" | null` and `planIteration: number`.
2. `KNOWN_KEYS` in `state-io.ts` includes `"planMode"` and `"planIteration"`.
3. `createInitialState()` returns `planMode: null` and `planIteration: 0`.
4. When entering the `plan` phase via `transition()`, state sets `planMode: "draft"` and `planIteration: 1`.
5. When leaving the `plan` phase via `transition()`, state sets `planMode: null`.

**`megapowers_plan_task` tool**

6. Calling `megapowers_plan_task` outside the `plan` phase returns an error.
7. Calling `megapowers_plan_task` when `planMode` is `"review"` returns an error.
8. Calling `megapowers_plan_task` with a new task ID in `draft` mode creates a frontmatter markdown file at `.megapowers/plans/<slug>/tasks/task-NNN.md` via `writePlanTask()`.
9. Creating a new task requires `id`, `title`, and `description`; missing fields return a validation error.
10. Creating a new task defaults `depends_on: []`, `no_test: false`, `files_to_modify: []`, `files_to_create: []`, `status: "draft"`.
11. Calling `megapowers_plan_task` with an existing task ID performs a partial merge — only provided fields are updated, existing frontmatter and body are preserved.
12. Providing `description` in an update replaces the task body; omitting it preserves the existing body.
13. The tool response includes the task file path, task title, and field change summary.

**`megapowers_plan_review` tool**

14. Calling `megapowers_plan_review` outside `plan` phase or when `planMode` is not `"review"` returns an error.
15. `megapowers_plan_review` with `verdict: "approve"` writes a review artifact via `writePlanReview()`, sets all task statuses to `"approved"`, generates `plan.md`, and advances to `implement` phase.
16. `megapowers_plan_review` with `verdict: "revise"` writes a review artifact, sets task statuses to `"approved"` or `"needs_revision"` per the verdict arrays, sets `planMode: "revise"`, and bumps `planIteration`.
17. `megapowers_plan_review` with `verdict: "revise"` when `planIteration >= MAX_PLAN_ITERATIONS` (4) returns an error message directing the user to intervene manually.
18. Both `approved_tasks` and `needs_revision_tasks` params are used to update individual task file statuses.

**`plan_draft_done` signal**

19. A new `plan_draft_done` action on `megapowers_signal` transitions `planMode` from `"draft"` or `"revise"` to `"review"`.
20. `plan_draft_done` returns an error if no task files exist (via `listPlanTasks()`).
21. `plan_draft_done` calls `newSession()` on mode transition.

**`review_approve` deprecation**

22. Calling `megapowers_signal` with `review_approve` returns a deprecation error message directing the user to `megapowers_plan_review`.

**Workflow config**

23. Feature workflow phases list is `[brainstorm, spec, plan, implement, verify, code-review, done]` — no `review` entry.
24. Bugfix workflow phases list is `[reproduce, diagnose, plan, implement, verify, done]` — no `review` entry.
25. No transitions reference the `review` phase as `from` or `to` in either workflow.
26. `Phase` type union retains `"review"` for backward compatibility with existing state files.

**Write policy**

27. In `plan` phase with `planMode: "draft"`, `write`/`edit` calls to task files under `tasks/` are blocked — only `megapowers_plan_task` can create them.
28. In `plan` phase with `planMode: "review"`, `megapowers_plan_task` is blocked and no task file modifications are allowed.
29. In `plan` phase with `planMode: "revise"`, `megapowers_plan_task` can update frontmatter and `edit` can modify task file bodies.

**Bridge: `plan.md` generation**

30. On reviewer approval, `generateLegacyPlanMd()` produces a `plan.md` from task files with `### Task N: Title` headings, `[no-test]` and `[depends: N, M]` annotations.
31. The generated `plan.md` is parseable by the existing `extractPlanTasks()` regex parser, preserving backward compatibility.

**Prompt routing**

32. When `planMode` is `"draft"`, the prompt system loads `write-plan.md` (reworked to instruct use of `megapowers_plan_task` tool).
33. When `planMode` is `"review"`, the prompt system loads `review-plan.md` (reworked to instruct use of `megapowers_plan_review` tool).
34. When `planMode` is `"revise"`, the prompt system loads a new `revise-plan.md` template.

**`newSession()` integration**

35. Mode transitions from `draft`→`review`, `review`→`revise`, and `revise`→`review` each trigger `newSession()`.

**#066 API fixes (prerequisite)**

36. `readPlanTask`, `readPlanSummary`, `readPlanReview` return `EntityDoc<T> | { error: string } | null` — `null` for not found, `{ error }` for parse failure.
37. `zeroPad` uses `padStart(3, "0")` (3 digits) instead of `padStart(2, "0")`.

**Iteration cap constant**

38. `MAX_PLAN_ITERATIONS` is a named constant set to `4`.

## Out of Scope

- Migrating `deriveTasks()` from `plan.md` regex parsing to `plan-store.listPlanTasks()`
- Migrating `plan_content` interpolation in downstream prompts to read from task files
- Updating the plan→implement gate from `requireArtifact: "plan.md"` to a new `requireTasks` gate type
- Deleting `plan-parser.ts`, `extractPlanTasks`, or the generated `plan.md` bridge
- Model/thinking switching per plan mode
- Using `PlanSummary` entity (YAGNI for this issue)
- Configurable iteration cap (hardcoded for now)

## Open Questions

*(none)*
