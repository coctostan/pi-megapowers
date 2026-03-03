# Brainstorm: Plan-Review Iterative Loop Wiring

## Context & Motivation

The current workflow has `plan` and `review` as separate phases. The `plan` phase produces a monolithic `plan.md` parsed by regex (`extractPlanTasks` in `plan-parser.ts`). The `review` phase is gated by `reviewApproved` boolean and the `review_approve` signal. This is brittle: the regex parser breaks on format drift, plan quality depends on a single pass, and the human must manually approve via signal.

Issue #066 shipped the data layer — `entity-parser.ts`, `plan-schemas.ts`, `plan-store.ts` — with zero consumers. This issue wires that layer into the workflow as a draft/review/revise loop inside a single `plan` phase, replacing the split `plan` + `review` phases.

## Approach

Replace the split `plan` + `review` workflow phases with a single `plan` phase containing an internal draft/review/revise loop. The plan phase becomes **modal** with three modes (`draft`, `review`, `revise`), each getting a fresh `newSession()` to eliminate role bias. Two new tools (`megapowers_plan_task` and `megapowers_plan_review`) handle all structured data flow via typed tool params — no regex parsing on the write path. All artifacts are frontmatter markdown, read by the entity-parser from #066 and written by tool handlers.

On reviewer approval, the system generates a backward-compatible `plan.md` from the approved task files, so all downstream consumers (implement, verify, pipeline, etc.) keep working without changes. A follow-up issue will migrate those consumers to read task files directly via plan-store, then delete the generated `plan.md` bridge.

Both feature and bugfix workflows get the same mechanism — the loop activates whenever the state machine is in the `plan` phase. The `review` phase is removed from both workflow configs.

## Key Decisions

- **Dedicated tools over file writes** — `megapowers_plan_task` and `megapowers_plan_review` accept structured params, validate at write time via zod schemas, return rich feedback. No regex. No file parsing for signaling.
- **All artifacts are frontmatter markdown** — universal pattern going forward. Entity-parser reads, tools write. This is the first phase to adopt it; eventually every artifact will follow.
- **`newSession()` on every mode transition** — drafter, reviewer, and reviser each get a fresh context window. Eliminates role bias. Architecture supports future model/thinking switching per mode.
- **Description as a single string tool param** — the markdown body (including code blocks) is passed as a JSON string field in the tool call. LLMs handle JSON-encoded markdown well. One file per task, not two.
- **Hybrid revise approach** — `megapowers_plan_task` tool for frontmatter field updates (partial merge over existing values), `read`/`edit` for surgical body changes on existing task files. Avoids re-submitting 100 lines to change one.
- **Iteration cap of 4** — `MAX_PLAN_ITERATIONS = 4` hardcoded constant, eventually configurable. On cap hit: stop the loop, surface a clear message to the human, require manual intervention.
- **Backward-compatible `plan.md` generation** — on approve, render task files into the legacy `plan.md` format (`### Task N:` headings). Zero downstream consumer changes needed. This is explicitly temporary bridge code.
- **`review_approve` signal retired** — review verdict comes through the `megapowers_plan_review` tool. The old `review_approve` signal returns a deprecation error.
- **066 API fixes included** — widen `readPlanTask`/`readPlanSummary`/`readPlanReview` return types, bump `zeroPad` to 3 digits, minor cleanups. Done first, before adding consumers.
- **Both workflows** — feature and bugfix get the same plan loop. `review` phase removed from both.

## Components — Detailed Design

### 1. State Changes (`state-machine.ts` + `state-io.ts`)

Add two new fields to `MegapowersState`:

```
planMode: "draft" | "review" | "revise" | null  // null when not in plan phase
planIteration: number                            // starts at 1, bumps on each revise→review
```

Add to `KNOWN_KEYS` in `state-io.ts`: `"planMode"`, `"planIteration"`.

Add to `createInitialState()`: `planMode: null`, `planIteration: 0`.

In `transition()` in `state-machine.ts`: when entering `plan` phase, set `planMode: "draft"`, `planIteration: 1`. When leaving `plan` phase, set `planMode: null`.

Add constant: `MAX_PLAN_ITERATIONS = 4`.

### 2. `megapowers_plan_task` Tool

**Tool definition** (JSON schema for LLM):
```json
{
  "name": "megapowers_plan_task",
  "description": "Save or update a plan task. During draft mode, creates new tasks. During revise mode, updates existing tasks (partial — only provided fields are merged). Use read/edit for surgical body changes.",
  "parameters": {
    "type": "object",
    "properties": {
      "id": { "type": "number", "description": "Task ID (1-based, sequential)" },
      "title": { "type": "string", "description": "Short task title" },
      "description": { "type": "string", "description": "Full task body — TDD steps, code blocks, implementation details (markdown)" },
      "depends_on": { "type": "array", "items": { "type": "number" }, "description": "IDs of tasks this depends on" },
      "no_test": { "type": "boolean", "description": "true if this task doesn't need TDD (e.g. prompt-only, config changes)" },
      "files_to_modify": { "type": "array", "items": { "type": "string" }, "description": "Existing files this task changes" },
      "files_to_create": { "type": "array", "items": { "type": "string" }, "description": "New files this task creates" }
    },
    "required": ["id"]
  }
}
```

**Handler logic** (`tool-plan-task.ts`):

1. Read state. Validate `phase === "plan"` and `planMode` is `"draft"` or `"revise"`.
2. If task file exists (via `readPlanTask()`):
   - **Update mode**: merge provided fields over existing frontmatter. If `description` is provided, replace body. If not, preserve existing body. Write via `writePlanTask()`.
   - Response: `✅ Task {id} updated: "{title}" → {path}\n  Changed: {list of changed fields}`
3. If task file does not exist:
   - **Create mode**: require `id`, `title`, `description`. Default `depends_on: []`, `no_test: false`, `files_to_modify: []`, `files_to_create: []`, `status: "draft"`.
   - Validate via `PlanTaskSchema.safeParse()`. Return clear error on validation failure.
   - Write via `writePlanTask()`.
   - Response: `✅ Task {id} saved: "{title}"\n  → {path}\n  depends_on: {deps} | files: {files}\n  {N} tasks saved this session`
4. On validation error: return `❌ Task {id} invalid: {zod error messages}`

**Write policy**: In `draft` mode, only this tool can create task files. In `revise` mode, this tool can update frontmatter, and `edit` can modify task file bodies. In `review` mode, this tool is blocked.

### 3. `megapowers_plan_review` Tool

**Tool definition** (JSON schema for LLM):
```json
{
  "name": "megapowers_plan_review",
  "description": "Submit plan review verdict. Approves the plan or requests revisions with per-task feedback.",
  "parameters": {
    "type": "object",
    "properties": {
      "verdict": { "type": "string", "enum": ["approve", "revise"], "description": "Overall verdict" },
      "approved_tasks": { "type": "array", "items": { "type": "number" }, "description": "Task IDs that pass review" },
      "needs_revision_tasks": { "type": "array", "items": { "type": "number" }, "description": "Task IDs that need revision" },
      "feedback": { "type": "string", "description": "Review feedback — per-task assessment, issues found, suggestions (markdown)" }
    },
    "required": ["verdict", "feedback"]
  }
}
```

**Handler logic** (`tool-plan-review.ts`):

1. Read state. Validate `phase === "plan"` and `planMode === "review"`.
2. Validate that `approved_tasks` + `needs_revision_tasks` cover all existing task IDs (warn if not).
3. Write review artifact via `writePlanReview()` with frontmatter: `{ type: "plan-review", iteration: state.planIteration, verdict, reviewed_tasks: [...approved, ...needs_revision], approved_tasks, needs_revision_tasks }` and body: `feedback`.
4. Update task file statuses: set each task's `status` to `"approved"` or `"needs_revision"` based on the verdict.
5. **If verdict is `"approve"`**:
   - Generate backward-compatible `plan.md` from task files (see Bridge section).
   - Transition: set `planMode: null`, advance to `implement` phase via `advancePhase()`.
   - Response: `📋 Plan approved (iteration {N})\n  ✅ All {count} tasks approved\n  → Generated plan.md for downstream consumers\n  → Advancing to implement phase`
6. **If verdict is `"revise"`**:
   - Check iteration cap: if `planIteration >= MAX_PLAN_ITERATIONS`, return error: `⚠️ Plan review reached {N} iterations without approval. Human intervention needed.`
   - Transition: set `planMode: "revise"`, bump `planIteration`. Call `newSession()`.
   - Response: `📋 Plan review: REVISE (iteration {N} of {MAX})\n  ✅ Tasks {approved} approved\n  ⚠️ Tasks {needs_rev} need revision\n  → Transitioning to revise mode`

### 4. Signal Extensions

**`plan_draft_done`** — new action on `megapowers_signal`:
1. Read state. Validate `phase === "plan"` and `planMode` is `"draft"` or `"revise"`.
2. Validate at least one task file exists (via `listPlanTasks()`). Return error if zero tasks.
3. Transition: set `planMode: "review"`. Call `newSession()`.
4. Response: `📝 Draft complete: {N} tasks saved\n  → Transitioning to review mode`

**`review_approve`** — returns deprecation error:
`❌ review_approve is deprecated. Plan review is now handled by the megapowers_plan_review tool within the plan phase. The reviewer calls megapowers_plan_review({ verdict: "approve", ... }) to approve.`

### 5. Mode-Aware Prompt Routing

The prompt system needs to select different templates based on `planMode`. This follows the same pattern as the done phase's `doneMode` handling (per learnings: call `getPhasePromptTemplate` / `interpolatePrompt` directly, not through `buildPhasePrompt`).

In `prompt-inject.ts`, when `state.phase === "plan"`:
- `planMode === "draft"` → load `write-plan.md`
- `planMode === "review"` → load `review-plan.md`
- `planMode === "revise"` → load new `revise-plan.md`

`PHASE_PROMPT_MAP` entry for `plan` becomes empty/neutral (same as `done`). The modal selection happens in `buildInjectedPrompt()`.

**Prompt template changes:**
- `write-plan.md` — reworked to instruct agent to use `megapowers_plan_task` tool for each task, then signal `plan_draft_done`.
- `review-plan.md` — reworked to instruct agent to read task files from `tasks/` directory, evaluate against spec + acceptance criteria, then submit verdict via `megapowers_plan_review` tool. Same 6 review criteria (coverage, ordering, TDD, granularity, no-test, self-containment).
- `revise-plan.md` — **new file**. Instructs agent to read the review artifact (`review.md`) for feedback, read task files, update tasks marked `needs_revision` via `megapowers_plan_task` tool for frontmatter changes or `read`/`edit` for body changes. Then signal `plan_draft_done`.

### 6. Workflow Config Changes

**Feature workflow** (`feature.ts`):
```
phases: [
  brainstorm, spec, plan, implement, verify, code-review, done
]
```
Remove the `review` phase config entry. Remove `plan → review` and `review → implement` transitions. Remove `review → plan` backward transition. Keep `plan → implement` transition with gate `requireArtifact: "plan.md"` (generated on approve).

**Bugfix workflow** (`bugfix.ts`):
```
phases: [
  reproduce, diagnose, plan, implement, verify, done
]
```
Same changes: remove `review` phase and associated transitions.

**`Phase` type** (`state-machine.ts`): `review` stays in the union type for now (backward compat with existing state files), but is no longer reachable via transitions.

### 7. Write Policy Updates

In `canWrite()` / write-hook logic:
- **Plan phase, draft mode**: block `write`/`edit` on task files. Only `megapowers_plan_task` tool can create them. Allow `write` to other `.megapowers/` paths (brainstorm, spec, etc. are read-only but shouldn't error).
- **Plan phase, review mode**: block `megapowers_plan_task` tool. Only `megapowers_plan_review` tool writes. No task file modifications.
- **Plan phase, revise mode**: allow `megapowers_plan_task` for frontmatter updates. Allow `edit` on existing task files (for body changes). Block `write` to task files (must go through tool or edit).

### 8. Bridge: `plan.md` Generation

On reviewer approval, generate `plan.md` from task files:

```typescript
function generateLegacyPlanMd(tasks: EntityDoc<PlanTask>[]): string {
  const lines: string[] = ["# Plan\n"];
  for (const task of tasks) {
    const tags: string[] = [];
    if (task.data.no_test) tags.push("[no-test]");
    if (task.data.depends_on.length > 0) tags.push(`[depends: ${task.data.depends_on.join(", ")}]`);
    const tagStr = tags.length > 0 ? ` ${tags.join(" ")}` : "";
    lines.push(`### Task ${task.data.id}: ${task.data.title}${tagStr}\n`);
    lines.push(task.content.trim());
    lines.push("");
  }
  return lines.join("\n");
}
```

This output must be parseable by the existing `extractPlanTasks()` regex parser — that's the backward-compat guarantee. Verified by testing.

### 9. 066 API Fixes (Pre-requisite)

Before adding consumers, fix three issues from the 066 code review:

1. **Widen read signatures**: `readPlanTask`, `readPlanSummary`, `readPlanReview` currently return `null` for both "not found" and "parse failure". Change to: `EntityDoc<T> | { error: string } | null` — `null` = not found, `{ error }` = parse failure with details.

2. **Bump `zeroPad` to 3 digits**: `padStart(2, "0")` breaks at ID ≥ 100. Change to `padStart(3, "0")`. No migration needed since no task files exist yet.

3. **Minor cleanups**: Remove extra blank line in `plan-store.ts:17`. Narrow `let parsed: any` in `entity-parser.ts:21` to `let parsed: { data: Record<string, unknown>; content: string }`.

### 10. Data Flow Summary

```
DRAFT MODE:
  Agent ←prompt: write-plan.md→ reads spec/brainstorm from disk
  Agent →tool: megapowers_plan_task({ id, title, description, ... })→ plan-store writes task-NNN.md
  Agent →signal: plan_draft_done→ state: planMode="review", newSession()

REVIEW MODE:
  Agent ←prompt: review-plan.md→ reads task files + spec from disk
  Agent →tool: megapowers_plan_review({ verdict, feedback, ... })→ plan-store writes review.md
  If approve: generate plan.md, advance to implement
  If revise: state: planMode="revise", planIteration++, newSession()

REVISE MODE:
  Agent ←prompt: revise-plan.md→ reads review.md + task files from disk
  Agent →tool: megapowers_plan_task({ id, depends_on: [1,2] })→ partial frontmatter update
  Agent →edit: surgical body changes on task files→ direct file edit
  Agent →signal: plan_draft_done→ state: planMode="review", newSession()

CAP HIT (iteration > 4):
  megapowers_plan_review returns error → human must intervene
```

### 11. Tool Response Format

Every tool call returns visible feedback for both human (TUI) and LLM (tool result):

**megapowers_plan_task (create)**:
```
✅ Task 3 saved: "Wire plan-mode into state machine"
  → .megapowers/plans/085-.../tasks/task-003.md
  depends_on: [1, 2] | files: state-machine.ts, state-io.ts
  3 tasks saved this session
```

**megapowers_plan_task (update)**:
```
✅ Task 3 updated: "Wire plan-mode into state machine"
  Changed: depends_on [1] → [1, 2]
```

**megapowers_plan_review (approve)**:
```
📋 Plan approved (iteration 1)
  ✅ All 7 tasks approved
  → Generated plan.md for downstream consumers
  → Advancing to implement phase
```

**megapowers_plan_review (revise)**:
```
📋 Plan review: REVISE (iteration 2 of 4)
  ✅ Tasks 1, 2, 4 approved
  ⚠️ Tasks 3, 5 need revision
  → Transitioning to revise mode. newSession() will be called.
```

**plan_draft_done signal**:
```
📝 Draft complete: 7 tasks saved
  → Transitioning to review mode. newSession() will be called.
```

**Iteration cap hit**:
```
⚠️ Plan review reached 4 iterations without approval. Human intervention needed.
  Use /mega off to disable enforcement and manually advance, or revise the spec.
```

## Testing Strategy

- **Tool handlers** — pure functions: structured input → file write + response string. Test with real filesystem (tempdir), no pi dependency. Test create, update, partial merge, validation errors.
- **Mode transitions** — state machine tests: given state + signal/tool action → new state. Verify `planMode`, `planIteration`, and that `newSession()` is called.
- **Iteration cap** — test that `megapowers_plan_review({ verdict: "revise" })` at `planIteration === 4` returns the cap-hit error instead of transitioning.
- **Partial update merge** — test that tool call with subset of fields preserves existing frontmatter values and body, overwrites only provided fields.
- **Write policy per mode** — test that draft blocks `edit` on task files, revise allows it, review blocks task tool.
- **`plan.md` generation** — test that `generateLegacyPlanMd()` output is parseable by `extractPlanTasks()` for N tasks including `[no-test]` and `[depends: N, M]` annotations. This proves backward compatibility.
- **Prompt routing** — test that `buildInjectedPrompt()` returns the correct template content for each `planMode` value.
- **`review_approve` deprecation** — test that the old signal returns a clear deprecation error.
- **Workflow config** — test that feature/bugfix workflows no longer have `review` in phases array and no `review`-related transitions.
- **Task status updates** — test that review tool sets `status: "approved"` / `"needs_revision"` on task files per the verdict.

## Out of Scope (follow-up issue)

- Migrate `deriveTasks()` from `plan.md` regex parsing → `plan-store.listPlanTasks()`
- Migrate `plan_content` interpolation in downstream prompts to render from task files
- Update gate from `requireArtifact: "plan.md"` → new `requireTasks` gate type
- Delete `plan-parser.ts`, `extractPlanTasks`, and the generated `plan.md` bridge
- Model/thinking switching per plan mode
- Plan summary entity (`PlanSummary` schema exists but is YAGNI for this issue)
