## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "phase_next" }` — Advance to the next workflow phase
- `{ action: "phase_back" }` — Go back one phase using workflow-defined backward transitions (review→plan, verify→implement, code-review→implement)
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approive the plan during review phase
- `{ action: "tests_failed" }` — Signal that tests failed (RED in TDD cycle — unlocks production code writes)
- `{ action: "tests_passed" }` — Signal that tests passed (GREEN in TDD cycle)

### Artifact Persistence
Save phase output by writing files directly under `.megapowers/plans/<issue-slug>/` using `write` (or `edit` for incremental updates).
- Example: `.megapowers/plans/<issue-slug>/spec.md`
- Always save your work before advancing to the next phase

### Version Control
Version control is managed automatically via jj. **Do not run jj or git commands.** Phase changes, bookmarks, and commits are handled by the system.

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly. Do NOT edit `.megapowers/state.json`.


You are writing a step-by-step implementation plan from a spec. Each task maps 1:1 to a test. A developer with zero context about this codebase should be able to execute any task from this plan alone.

> **Workflow:** brainstorm → spec → **plan** → review → implement → verify → code-review → done

## Context
Issue: 085-plan-review-iterative-loop-wiring

## Spec
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


## Brainstorm Notes
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
- **Description as a single string tool param** — the markdown body (including code blocks) is passed as a a JSON string field in the tool call. LLMs handle JSON-encoded markdown well. One file per task, not two.
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


> **Bugfix note:** In bugfix workflows, "Spec" above contains the **diagnosis** (with "Fixed When" criteria instead of acceptance criteria) and "Brainstorm Notes" contains the **reproduction report**. Plan tasks should:
> - Address every "Fixed When" criterion
> - **Task 1 should adopt or build on the failing test from the reproduction report** (if one was written) — don't duplicate or ignore it
> - Include a regression test that reproduces the original bug's exact steps

## Instructions

Each task should be **bite-sized** — a single test and its minimal implementation. If a task takes more than 5 minutes to describe, it's too big. Split it.

### Task structure

Every task follows the 5-step TDD cycle:

```
### Task N: [Name] [depends: 1, 2]

**Files:**
- Create: `exact/path/to/file`
- Modify: `exact/path/to/existing`
- Test: `exact/path/to/test`

**Step 1 — Write the failing test**
[Full test code]

**Step 2 — Run test, verify it fails**
Run: [exact command to run this specific test]
Expected: FAIL — [specific error message or failure description]

**Step 3 — Write minimal implementation**
[Full implementation code — just enough to pass the test]

**Step 4 — Run test, verify it passes**
Run: [same command as Step 2]
Expected: PASS

**Step 5 — Verify no regressions**
Run: [project's full test suite command]
Expected: all passing
```

Check `AGENTS.md` for the project's language, test framework, and test runner. If not documented there, infer from the codebase (package.json, Cargo.toml, pyproject.toml, etc.). Use the project's actual conventions for file extensions, test locations, and run commands.

### No-test tasks

Some tasks don't have a meaningful test — config changes, documentation, CI setup, type-only refactors. Mark these with `[no-test]`:

```
### Task N: [Name] [no-test]

**Justification:** [Why this task has no test — must be a real reason, not laziness]

**Files:**
- Modify: `exact/path/to/file`

**Step 1 — Make the change**
[Full change description or code]

**Step 2 — Verify**
Run: [build command, type check, or other verification]
Expected: [success criteria]
```

Use `[no-test]` sparingly. If a task changes behavior, it needs a test. Valid reasons: config-only, documentation, pure refactor with existing test coverage, CI/tooling setup, prompt/skill file changes.

For **prompt or skill changes**: use `[no-test]` but include a subagent verification step if possible — run a scenario with the updated prompt and confirm the LLM behaves as expected. This isn't enforced yet but is strongly recommended.

### Key requirements

- **Complete code** — no "implement something similar" or "add validation here"
- **Expected test output** — Step 2 must specify what the failure looks like. This catches tests that pass when they shouldn't.
- **Minimal implementation** — Step 3 writes just enough to make the test pass, nothing more
- **Exact file paths** — every file referenced must include its full path from project root

## Rules
- Tasks must be **independently verifiable** — if a task has "and" in it, split it
- Task order must **respect dependencies** — foundational pieces first
- **Annotate dependencies** — if a task requires output from prior tasks, add `[depends: N, M]` to the title. Omit for tasks with no dependencies.
- **Coverage** — each acceptance criterion from the spec must be covered by at least one task. Call out the mapping explicitly (e.g., "Covers AC 3").
- **YAGNI** — no tasks for speculative features
- **DRY** — extract shared code into utilities, don't duplicate

## Saving

When the plan is complete, save it to `.megapowers/plans/085-plan-review-iterative-loop-wiring/plan.md`:
```
write({ path: ".megapowers/plans/085-plan-review-iterative-loop-wiring/plan.md", content: "<full plan content>" })
```
(Use `edit` for incremental revisions.)
Then advance with `megapowers_signal({ action: "phase_next" })`.
