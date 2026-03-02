# Verification Report — 085-plan-review-iterative-loop-wiring

## Test Suite Results

```
bun test
674 pass
0 fail
1400 expect() calls
Ran 674 tests across 58 files. [551ms]
```

All tests pass. No failures.

---

## Per-Criterion Verification

### Criterion 1: `MegapowersState` includes `planMode: "draft" | "review" | "revise" | null` and `planIteration: number`
**Evidence:** `extensions/megapowers/state/state-machine.ts` lines 8, 50-51:
```ts
export type PlanMode = "draft" | "review" | "revise" | null;
// ...
planMode: PlanMode;
planIteration: number;
```
**Verdict:** pass

---

### Criterion 2: `KNOWN_KEYS` in `state-io.ts` includes `"planMode"` and `"planIteration"`
**Evidence:** `extensions/megapowers/state/state-io.ts` lines 11-15:
```ts
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "reviewApproved", "planMode", "planIteration", "currentTaskIndex", "completedTasks",
  "tddTaskState", "taskJJChanges", "jjChangeId", "doneActions", "megaEnabled",
]);
```
**Verdict:** pass

---

### Criterion 3: `createInitialState()` returns `planMode: null` and `planIteration: 0`
**Evidence:** `extensions/megapowers/state/state-machine.ts` lines 75-93:
```ts
export function createInitialState(): MegapowersState {
  return {
    ...
    planMode: null,
    planIteration: 0,
    ...
  };
}
```
Test: `state-machine.test.ts` — "includes completedTasks and currentTaskIndex" (general initialState tests) pass.
**Verdict:** pass

---

### Criterion 4: Entering `plan` phase via `transition()` sets `planMode: "draft"` and `planIteration: 1`
**Evidence:** `extensions/megapowers/state/state-machine.ts` lines 131-135:
```ts
if (to === "plan") {
  next.reviewApproved = false;
  next.planMode = "draft";
  next.planIteration = 1;
}
```
Test: `state-machine.test.ts` — "sets planMode to 'draft' and planIteration to 1 when entering plan phase" passes.
**Verdict:** pass

---

### Criterion 5: Leaving `plan` phase via `transition()` sets `planMode: null`
**Evidence:** `extensions/megapowers/state/state-machine.ts` lines 137-140:
```ts
if (state.phase === "plan" && to !== "plan") {
  next.planMode = null;
}
```
Test: `state-machine.test.ts` — "resets planMode to null when leaving plan phase (plan → implement)" passes.
**Verdict:** pass

---

### Criterion 6: Calling `megapowers_plan_task` outside `plan` phase returns an error
**Evidence:** `extensions/megapowers/tools/tool-plan-task.ts` lines 24-26:
```ts
if (state.phase !== "plan") {
  return { error: "megapowers_plan_task can only be called during the plan phase." };
}
```
Test: `tool-plan-task.test.ts` — "returns error when not in plan phase" passes.
**Verdict:** pass

---

### Criterion 7: Calling `megapowers_plan_task` when `planMode` is `"review"` returns an error
**Evidence:** `extensions/megapowers/tools/tool-plan-task.ts` lines 28-30:
```ts
if (state.planMode === "review") {
  return { error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict." };
}
```
Test: `tool-plan-task.test.ts` — "returns error when planMode is review" passes.
**Verdict:** pass

---

### Criterion 8: New task ID in `draft` mode creates `.megapowers/plans/<slug>/tasks/task-NNN.md` via `writePlanTask()`
**Evidence:** `tool-plan-task.ts` line 67 calls `writePlanTask(cwd, slug, task, params.description)`. Path construction at line 71: `` `.megapowers/plans/${slug}/tasks/task-${String(task.id).padStart(3, "0")}.md` ``. `plan-store.ts` `writePlanTask()` uses `taskFilePath()` with `zeroPad()` (3-digit) and `mkdirSync({ recursive: true })`.
Test: `tool-plan-task.test.ts` — "creates a task file in draft mode with all defaults" passes.
**Verdict:** pass

---

### Criterion 9: Creating a new task requires `id`, `title`, and `description`; missing fields return validation error
**Evidence:** `tool-plan-task.ts` lines 43-49:
```ts
if (!params.title) {
  return { error: `❌ Task ${params.id} invalid: title is required when creating a new task.` };
}
if (!params.description) {
  return { error: `❌ Task ${params.id} invalid: description is required when creating a new task.` };
}
```
Tests: "returns validation error when title is missing on create" and "returns validation error when description is missing on create" both pass.
**Verdict:** pass

---

### Criterion 10: Creating a new task defaults `depends_on: []`, `no_test: false`, `files_to_modify: []`, `files_to_create: []`, `status: "draft"`
**Evidence:** `tool-plan-task.ts` lines 51-59:
```ts
const task: PlanTask = {
  id: params.id,
  title: params.title,
  status: "draft",
  depends_on: params.depends_on ?? [],
  no_test: params.no_test ?? false,
  files_to_modify: params.files_to_modify ?? [],
  files_to_create: params.files_to_create ?? [],
};
```
Test: "creates a task file in draft mode with all defaults" passes (verifies these defaults on disk).
**Verdict:** pass

---

### Criterion 11: Existing task ID performs partial merge — only provided fields updated, existing frontmatter/body preserved
**Evidence:** `handleUpdate()` in `tool-plan-task.ts` lines 81-125: each field is only updated if explicitly provided (`!== undefined`). `merged` starts as `{ ...existing.data }`.
Test: "merges only provided fields, preserving existing values" passes.
**Verdict:** pass

---

### Criterion 12: `description` in update replaces task body; omitting preserves existing body
**Evidence:** `tool-plan-task.ts` line 111: `const body = params.description ?? existing.content;`
Tests: "replaces body when description is provided in update" and "preserves body when description is omitted in update" both pass.
**Verdict:** pass

---

### Criterion 13: Tool response includes task file path, task title, and field change summary
**Evidence:** Create response (`tool-plan-task.ts` lines 72-78) includes `` `✅ Task ${task.id} saved: "${task.title}"` ``, task path, and "Changed: title, description, ...". Update response (lines 119-124) includes `"✅ Task N updated: title"`, path, `"Changed: [fields]"`.
Tests: "create response includes title, file path, and change summary" and "update response includes title, file path, and changed field list" pass.
**Verdict:** pass

---

### Criterion 14: Calling `megapowers_plan_review` outside `plan` phase or when `planMode` is not `"review"` returns an error
**Evidence:** `tool-plan-review.ts` lines 26-32:
```ts
if (state.phase !== "plan") {
  return { error: "megapowers_plan_review can only be called during the plan phase." };
}
if (state.planMode !== "review") {
  return { error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.` };
}
```
Tests: "returns error when not in plan phase" and "returns error when planMode is not review" pass.
**Verdict:** pass

---

### Criterion 15: `verdict: "approve"` writes review artifact, sets all task statuses to `"approved"`, generates `plan.md`, advances to `implement`
**Evidence:** `handleApproveVerdict()` in `tool-plan-review.ts` lines 88-116: calls `writePlanReview()` (line 46 before branch), `updateTaskStatuses(all tasks, "approved")` (line 96), `generateLegacyPlanMd()` and `writeFileSync(plan.md)` (lines 99-101), `transition(state, "implement")` and `writeState()` (lines 104-107).
Tests: "sets all task statuses to approved", "generates plan.md file", "advances to implement phase", "returns success message with task count" all pass.
**Verdict:** pass

---

### Criterion 16: `verdict: "revise"` writes review artifact, sets statuses per verdict arrays, sets `planMode: "revise"`, bumps `planIteration`
**Evidence:** `tool-plan-review.ts` lines 46-53: `writePlanReview()` called unconditionally; `updateTaskStatuses(approvedIds, "approved")` and `updateTaskStatuses(needsRevisionIds, "needs_revision")` called before branching. `handleReviseVerdict()` lines 72-76: writes state with `planMode: "revise"`, `planIteration: state.planIteration + 1`.
Tests: "sets planMode to revise and bumps iteration" and "updates task statuses per verdict arrays" pass.
**Verdict:** pass

---

### Criterion 17: `verdict: "revise"` when `planIteration >= MAX_PLAN_ITERATIONS (4)` returns error directing user to intervene manually
**Evidence:** `tool-plan-review.ts` lines 64-70:
```ts
if (state.planIteration >= MAX_PLAN_ITERATIONS) {
  return {
    error:
      `⚠️ Plan review reached ${MAX_PLAN_ITERATIONS} iterations without approval. Human intervention needed.\n` +
      "  Use /mega off to disable enforcement and manually advance, or revise the spec.",
  };
}
```
`MAX_PLAN_ITERATIONS = 4` (state-machine.ts line 10).
Test: "returns error at iteration cap (MAX_PLAN_ITERATIONS = 4)" passes.
**Verdict:** pass

---

### Criterion 18: Both `approved_tasks` and `needs_revision_tasks` params used to update individual task file statuses
**Evidence:** `tool-plan-review.ts` lines 48-49:
```ts
updateTaskStatuses(cwd, slug, approvedIds, "approved");
updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
```
`updateTaskStatuses()` reads each task file, updates status, and writes it back.
Test: "updates task statuses per verdict arrays" passes.
**Verdict:** pass

---

### Criterion 19: `plan_draft_done` action transitions `planMode` from `"draft"` or `"revise"` to `"review"`
**Evidence:** `handlePlanDraftDone()` in `tool-signal.ts` lines 251-260: validates `planMode` is `"draft"` or `"revise"`, then calls `writeState(cwd, { ...state, planMode: "review" })`.
Tests: "transitions planMode from draft to review" and "transitions planMode from revise to review" pass.
**Verdict:** pass

---

### Criterion 20: `plan_draft_done` returns error if no task files exist (via `listPlanTasks()`)
**Evidence:** `tool-signal.ts` lines 255-258:
```ts
const tasks = listPlanTasks(cwd, state.activeIssue!);
if (tasks.length === 0) {
  return { error: "No task files found. Use megapowers_plan_task to create tasks before signaling draft done." };
}
```
Test: "returns error when no tasks exist" in tool-signal.test.ts passes.
**Verdict:** pass

---

### Criterion 21: `plan_draft_done` calls `newSession()` on mode transition
**Evidence:** `tool-signal.ts` line 266: `triggerNewSession: true` returned. `register-tools.ts` lines 41-44: when `result.triggerNewSession`, calls `(ctx.sessionManager as any)?.newSession?.()`.
Test: `new-session-wiring.test.ts` — "megapowers_signal(plan_draft_done) starts a new session" with `newSessionCalls === 1` passes.
**Verdict:** pass

---

### Criterion 22: Calling `megapowers_signal` with `review_approve` returns deprecation error directing user to `megapowers_plan_review`
**Evidence:** `handleReviewApprove()` in `tool-signal.ts` lines 275-279:
```ts
return {
  error: "❌ review_approve is deprecated. Plan review is now handled by the megapowers_plan_review tool within the plan phase. The reviewer calls megapowers_plan_review({ verdict: \"approve\", ... }) to approve.",
};
```
Test: `tool-signal.test.ts` — "review_approve deprecation" — `result.error` contains "megapowers_plan_review" passes.
**Verdict:** pass

---

### Criterion 23: Feature workflow phases list is `[brainstorm, spec, plan, implement, verify, code-review, done]` — no `review` entry
**Evidence:** `extensions/megapowers/workflows/feature.ts` lines 6-14: phases array has exactly 7 entries: brainstorm, spec, plan, implement, verify, code-review, done. No `review` phase.
Test: `workflow-configs.test.ts` — "has 7 phases in correct order" and "has no review entry in phases array" pass.
**Verdict:** pass

---

### Criterion 24: Bugfix workflow phases list is `[reproduce, diagnose, plan, implement, verify, done]` — no `review` entry
**Evidence:** `extensions/megapowers/workflows/bugfix.ts` lines 6-13: phases array has exactly 6 entries: reproduce, diagnose, plan, implement, verify, done. No `review` phase.
Test: `workflow-configs.test.ts` — "has 6 phases in correct order" passes.
**Verdict:** pass

---

### Criterion 25: No transitions reference the `review` phase as `from` or `to` in either workflow
**Evidence:** `grep -n "review" extensions/megapowers/workflows/feature.ts` returns only `code-review` entries. `grep -n "review" extensions/megapowers/workflows/bugfix.ts` returns zero results.
Tests: `workflow-configs.test.ts` — "has no transitions referencing review phase" (both feature and bugfix) pass.
**Verdict:** pass

---

### Criterion 26: `Phase` type union retains `"review"` for backward compatibility with existing state files
**Evidence:** `extensions/megapowers/state/state-machine.ts` lines 5-7:
```ts
export type FeaturePhase = "brainstorm" | "spec" | "plan" | "review" | "implement" | "verify" | "code-review" | "done";
export type BugfixPhase = "reproduce" | "diagnose" | "plan" | "review" | "implement" | "verify" | "done";
export type Phase = FeaturePhase | BugfixPhase;
```
`"review"` is retained in both union types.
**Verdict:** pass

---

### Criterion 27: In `plan` phase with `planMode: "draft"`, `write`/`edit` calls to task files under `tasks/` are blocked
**Evidence:** `write-policy.ts` lines 85-91: when `phase === "plan" && isTaskFile(filePath) && planMode` — if `planMode === "draft"`, returns `{ allowed: false, reason: "task file writes are blocked in draft mode..." }`.
Test: "blocks write/edit to task files in draft mode" passes.
**Verdict:** pass

---

### Criterion 28: In `plan` phase with `planMode: "review"`, `megapowers_plan_task` is blocked and no task file modifications are allowed
**Evidence:** `megapowers_plan_task` blocked: `tool-plan-task.ts` lines 28-30 (criterion 7). Task file writes blocked: `write-policy.ts` lines 85-91 — `planMode === "review"` returns `{ allowed: false }`.
Tests: "returns error when planMode is review" (tool-plan-task.test.ts) and "blocks write/edit to task files in review mode" (write-policy-plan-mode.test.ts) both pass.
**Verdict:** pass

---

### Criterion 29: In `plan` phase with `planMode: "revise"`, `megapowers_plan_task` can update frontmatter and `edit` can modify task file bodies
**Evidence:** `write-policy.ts` lines 92-97: `planMode === "revise" && toolName === "write"` → blocked; `edit` is allowed (no matching block). `megapowers_plan_task` is allowed in revise mode: `tool-plan-task.ts` lines 32-34 only blocks when `planMode !== "draft" && planMode !== "revise"`.
Tests: "allows edit to task files in revise mode" and "blocks write (not edit) to task files in revise mode" pass. "works in revise mode (updates existing task)" passes.
**Verdict:** pass

---

### Criterion 30: `generateLegacyPlanMd()` produces `plan.md` from task files with `### Task N: Title` headings, `[no-test]` and `[depends: N, M]` annotations
**Evidence:** `legacy-plan-bridge.ts` lines 8-25: iterates tasks, generates `### Task ${task.data.id}: ${task.data.title}${tagStr}` headings. `[no-test]` added when `task.data.no_test === true`. `[depends: N, M]` added when `depends_on.length > 0`.
Tests: "generates plan.md with ### Task N: Title headers", "includes [no-test] annotation", "includes [depends: N, M] annotation" all pass.
**Verdict:** pass

---

### Criterion 31: Generated `plan.md` is parseable by the existing `extractPlanTasks()` regex parser, preserving backward compatibility
**Evidence:** `legacy-plan-bridge.test.ts` test: "is parseable by extractPlanTasks (backward compat)" imports `extractPlanTasks` from `plan-parser.ts` and verifies the generated content round-trips correctly.
**Verdict:** pass

---

### Criterion 32: When `planMode` is `"draft"`, the prompt system loads `write-plan.md`
**Evidence:** `prompt-inject.ts` lines 138-149: when `state.phase === "plan" && state.planMode`, uses `PLAN_MODE_TEMPLATES` mapping `draft → "write-plan.md"`. File `prompts/write-plan.md` exists with content.
Test: `prompt-inject.test.ts` — "loads write-plan.md when planMode is draft" — result contains "You are writing a step-by-step implementation plan" passes.
**Verdict:** pass

---

### Criterion 33: When `planMode` is `"review"`, the prompt system loads `review-plan.md`
**Evidence:** `prompt-inject.ts` line 141: `review: "review-plan.md"`. File `prompts/review-plan.md` exists with `megapowers_plan_review` instructions.
Test: `prompt-inject.test.ts` — "loads review-plan.md when planMode is review" passes.
**Verdict:** pass

---

### Criterion 34: When `planMode` is `"revise"`, the prompt system loads a new `revise-plan.md` template
**Evidence:** `prompt-inject.ts` line 142: `revise: "revise-plan.md"`. File `prompts/revise-plan.md` exists (21 lines, starts with "You are revising a plan based on reviewer feedback."). Verified by ad-hoc test: when `planMode === "revise"`, `buildInjectedPrompt()` result contains "You are revising a plan based on reviewer feedback" (confirmed via `tests/verify-revise-mode.test.ts` run, then deleted).
The existing test "does not load write-plan.md when planMode is revise" verifies result is non-null and write-plan.md content absent.
**Verdict:** pass

---

### Criterion 35: Mode transitions `draft`→`review`, `review`→`revise`, `revise`→`review` each trigger `newSession()`
**Evidence:**
- `draft`→`review` (`plan_draft_done`): `tool-signal.ts` line 266 `triggerNewSession: true` → `register-tools.ts` calls `newSession()`.
- `review`→`revise` (`plan_review` with revise): `tool-plan-review.ts` line 84 `triggerNewSession: true` → `register-tools.ts` calls `newSession()`.
- `revise`→`review` (`plan_draft_done` in revise mode): same `handlePlanDraftDone()` handler returns `triggerNewSession: true`.
Tests: `new-session-wiring.test.ts` — "megapowers_signal(plan_draft_done) starts a new session" and "megapowers_plan_review(revise) starts a new session" both pass (`newSessionCalls === 1`). `tool-signal.test.ts` — "sets triggerNewSession flag" for plan_draft_done passes.
**Verdict:** pass

---

### Criterion 36: `readPlanTask`, `readPlanSummary`, `readPlanReview` return `EntityDoc<T> | { error: string } | null` — `null` for not found, `{ error }` for parse failure
**Evidence:** `plan-store.ts` function signatures:
- `readPlanTask`: returns `EntityDoc<PlanTask> | { error: string } | null` (line 33); returns `null` if file doesn't exist (line 35), delegates to `parseFrontmatterEntity` which returns `EntityDoc | { error }`.
- `readPlanSummary`: same pattern (line 76).
- `readPlanReview`: same pattern (line 65).
Tests: `plan-store.test.ts` — "returns null for nonexistent task", "returns null for nonexistent review", "returns null when summary file is missing", "returns { error } for invalid summary frontmatter" all pass.
**Verdict:** pass

---

### Criterion 37: `zeroPad` uses `padStart(3, "0")` (3 digits) instead of `padStart(2, "0")`
**Evidence:** `plan-store.ts` lines 6-8:
```ts
export function zeroPad(n: number): string {
  return String(n).padStart(3, "0");
}
```
Tests: `plan-store.test.ts` — "pads single digit to 3 chars" (1 → "001"), "pads double digit to 3 chars" (12 → "012"), "handles triple digit without padding" (100 → "100") all pass.
**Verdict:** pass

---

### Criterion 38: `MAX_PLAN_ITERATIONS` is a named constant set to `4`
**Evidence:** `extensions/megapowers/state/state-machine.ts` line 10: `export const MAX_PLAN_ITERATIONS = 4;`. Imported and used in `tool-plan-review.ts` line 6 and 64.
Test: `tool-plan-review.test.ts` — "returns error at iteration cap (MAX_PLAN_ITERATIONS = 4)" passes.
**Verdict:** pass

---

## Overall Verdict

**pass**

All 38 acceptance criteria are satisfied. Evidence gathered from:
- Fresh test run: **674 pass, 0 fail** across 58 files
- Direct code inspection of implementation files
- Per-criterion test mapping to test suite output

All key modules are implemented and wired:
- `state-machine.ts` — `planMode`, `planIteration`, `PlanMode`, `MAX_PLAN_ITERATIONS`, `transition()` hooks
- `state-io.ts` — `KNOWN_KEYS` updated
- `tool-plan-task.ts` — create/update with validation and partial merge
- `tool-plan-review.ts` — approve/revise verdicts, iteration cap, task status updates
- `tool-signal.ts` — `plan_draft_done`, `review_approve` deprecation, `newSession()` wiring
- `write-policy.ts` — plan-mode-aware task file restrictions
- `legacy-plan-bridge.ts` — `generateLegacyPlanMd()` backward-compatible output
- `plan-store.ts` — `zeroPad(3)`, correct return types
- `prompt-inject.ts` — plan-mode template routing
- `prompts/write-plan.md`, `review-plan.md`, `revise-plan.md` — all exist with correct content
- `workflows/feature.ts`, `workflows/bugfix.ts` — `review` phase removed from both
- `state-machine.ts` Phase type — retains `"review"` for backward compatibility
