# Brainstorm: Plan-Review Iterative Loop (#066)

## Approach

The `review` phase is removed as a separate workflow phase. Instead, the `plan` phase gains three internal modes: **draft**, **review**, and **revise**. Mode transitions are automatic — driven by artifact saves rather than explicit signals. When the agent saves plan tasks in draft mode, the system auto-transitions to review mode. When the reviewer saves feedback with an APPROVE verdict, the plan phase advances to implement. When the verdict is REVISE, the system enters revise mode. This loop continues until approval or an iteration cap is hit.

Plan tasks move from a monolithic `plan.md` to **per-task markdown files** with YAML frontmatter, stored under `.megapowers/plans/{issue-slug}/tasks/`. Each task file has a structured schema (index, title, description, files, dependencies, review status) validated by zod. A generic `entity-parser.ts` module provides `parseFrontmatterEntity<T>()` using gray-matter + zod — built for future reuse (issues, specs) but only used by plan tasks initially.

Mode transitions trigger `pi.newSession()` for a clean context break — the reviewer encounters the plan cold from disk, with no memory of the drafting process. A new `megapowers_plan_task` tool provides save/list/review/show actions, replacing `save_artifact` for plan content. The review prompt instructs the agent to evaluate each task against spec acceptance criteria and save per-task review status in the frontmatter. The revise prompt only shows tasks marked `needs_revision`, preventing the reviser from touching approved tasks.

## Key Decisions

- **Modes not phases** — draft/review/revise are internal to the `plan` phase, not separate workflow phases. Eliminates `reviewApproved` state and the awkward plan→review→plan backward transition.
- **Automatic transitions via artifact saves** — No new signal types. The system detects mode changes from what artifact is saved and its content (APPROVE/REVISE verdict). Simpler agent UX.
- **`newSession()` not `compact()`** — Clean context breaks between modes. The reviewer should have zero memory of the drafting process. Compaction leaks context.
- **Per-task files with frontmatter** — Enables per-task review granularity. Reviewer approves/rejects individual tasks. Reviser only sees rejected tasks. Better convergence than blob review.
- **Generic entity parser** — `parseFrontmatterEntity<T>(markdown, zodSchema)` using gray-matter + zod. Built generically for future reuse but only consumed by plan tasks in this issue.
- **Config file for model/thinking** — `.megapowers/config.json` with per-phase `{ model, thinking }` settings. Deferred to a follow-up issue — for now, users manually switch models via `/model` between modes.
- **Iteration cap** — `maxPlanIterations` (default 3) prevents infinite loops. When hit, auto-approves with a warning.
- **Scope split** — #066 covers entity parser + plan task entities + review loop. Per-phase automatic model/context switching is a separate follow-up issue.

## Components

### New Files
- **`entity-parser.ts`** — Generic frontmatter + zod parser. `parseFrontmatterEntity<T>(markdown, schema)` and `serializeFrontmatterEntity<T>(data, body, schema)`.
- **`plan-task-store.ts`** — CRUD for plan task files. Save, list, show, update review status. Reads/writes `.megapowers/plans/{slug}/tasks/task-{NN}.md`.
- **`tools/tool-plan-task.ts`** — `megapowers_plan_task` tool handler with save/list/review/show actions.
- **`prompts/revise-plan.md`** — Prompt template for revise mode. Shows only `needs_revision` tasks with reviewer feedback.

### Modified Files
- **`workflows/feature.ts`** and **`workflows/bugfix.ts`** — Remove `review` phase from phase lists.
- **`state/state-io.ts`** — Add `planMode` and `planIteration` to state schema.
- **`tools/tool-artifact.ts`** — Hook into save_artifact return to trigger mode transitions when phase is `plan`.
- **`prompt-inject.ts`** — Select prompt template based on `planMode` (draft→write-plan.md, review→review-plan.md, revise→revise-plan.md).
- **`ui.ts`** — Update FEATURE_PHASES and BUGFIX_PHASES arrays, remove review-specific UI.
- **`prompts/write-plan.md`** — Update to instruct agent to use `megapowers_plan_task` tool with per-task file format.
- **`prompts/review-plan.md`** — Update to read tasks from disk, evaluate per-task, save structured verdict.

### Removed
- **`reviewApproved`** field from state — replaced by `planMode` gating.
- **`review_approve` signal handling** — no longer needed as a separate signal; verdict parsing drives transitions.

## Testing Strategy

- **Entity parser** — Pure function tests: valid/invalid frontmatter, zod validation errors, body preservation, extra field stripping, malformed YAML handling.
- **Plan task store** — File I/O tests with temp dirs: save creates correct frontmatter files, list returns sorted tasks, show returns single task, review status updates persist to frontmatter.
- **`megapowers_plan_task` tool** — Handler tests with mocked store: validates action param, delegates correctly, returns formatted responses.
- **Mode transitions** — Core logic tests: draft→review on plan save, review→approved on APPROVE verdict, review→revise on REVISE verdict, revise→review on revised plan save, iteration cap triggers auto-approve.
- **Prompt injection** — Tests per planMode: draft injects write-plan.md, review injects review-plan.md, revise injects revise-plan.md.
- **`newSession()` integration** — Mock pi SDK, verify mode transitions call `pi.newSession()`.
- **Workflow definitions** — `review` phase removed from phase arrays, existing phase-advance tests updated.
- **Backward compatibility** — `review_approve` signal returns helpful error explaining the new flow.

### Out of Scope for Testing
- Actual LLM review quality
- Automatic model switching (follow-up issue)
- Entity parser applied to issues/specs (future reuse)
