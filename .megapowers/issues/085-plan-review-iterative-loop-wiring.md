---
id: 85
type: feature
status: closed
created: 2026-03-01T00:00:00.000Z
milestone: M3
priority: 1
---

# Plan-Review Iterative Loop — Wiring & API Fixes

Continuation of #066. That issue shipped the foundation data layer (`entity-parser.ts`, `plan-schemas.ts`, `plan-store.ts`). This issue wires it into the workflow and fixes two API design issues identified in the code review before any consumers are added.

## Part 1: API Fixes (before wiring consumers)

From the #066 code review — fix while the API has zero consumers:

**1. Widen read signatures** — `readPlanTask`, `readPlanSummary`, `readPlanReview` currently return `null` for both "file not found" and "parse failure", making them indistinguishable. Widen to `EntityDoc<T> | { error: string } | null` (null = not found, error = parse failure), matching the existing `listPlanTasks` pattern.

**2. Bump `zeroPad` to 3 digits** — `padStart(2, "0")` silently breaks at ID ≥ 100. Fix to `padStart(3, "0")` now, before any task files are written to disk that would require migration.

**3. Minor cleanups** — extra blank line in `plan-store.ts:20`, narrow `let parsed: any` in `entity-parser.ts` to `{ data: Record<string, unknown>; content: string }`.

## Part 2: Plan-Review Loop Wiring

Wire the data layer into the workflow as a single iterative `plan` phase replacing the current split `plan` + `review` phases.

### State changes
- Add `planMode: "draft" | "review" | "revise"` to `state.json`
- Add `planIteration: number` (default 1) and `maxPlanIterations: number` (default 3)
- Automatic mode transitions on artifact save
- `newSession()` on each mode transition for a clean context window

### Prompt routing
- Draft mode → `write-plan.md` prompt
- Review mode → `review-plan.md` prompt  
- Revise mode → `revise-plan.md` prompt (surfaces only `needs_revision` tasks)

### Phase restructuring
- Remove `review` as a separate workflow phase (feature workflow: brainstorm → spec → plan → implement → verify → code-review → done)
- `review_approve` signal: repurpose as plan-loop approval trigger or retire
- Iteration cap: after `maxPlanIterations` revise cycles, surface a decision prompt

### Task tooling
- Register `megapowers_plan_task` tool for agent to write individual task files during draft mode
- Migrate `getTasks()` / `currentTaskIndex` from `plan-parser.ts` → `plan-store.ts`
- Keep `plan-parser.ts` in place until migration is confirmed stable

### Open design questions (resolve during spec/brainstorm)
1. How does the agent save tasks — one tool call per task, or batch? What triggers "done drafting"?
2. Reviewer interaction model — per-task verdicts via tool calls? When is review "complete"?
3. Plan summary timing — before or after tasks?
4. Revise prompt isolation — does it only surface `needs_revision` tasks to the planner?
5. `review_approve` signal — repurpose or retire?
