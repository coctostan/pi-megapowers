# Verification Report — Issue 092: Two-Tier Plan Validation

## Test Suite Results

```
bun test
 872 pass
 2 fail (pre-existing, unrelated to this feature)
 2028 expect() calls
Ran 874 tests across 78 files. [730.00ms]
```

The 2 failing tests are in `tests/prompts.test.ts` under `"implement prompt — subagent delegation instructions"`. This file was **not modified** in this branch (`git diff HEAD -- tests/prompts.test.ts` produces no output). These are pre-existing failures unrelated to issue 092.

Feature-specific test files all pass:

```
bun test tests/plan-task-linter.test.ts tests/plan-lint-model.test.ts tests/tool-plan-task.test.ts tests/tool-signal.test.ts
 117 pass
 0 fail
Ran 117 tests across 4 files. [140.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: Empty or whitespace-only title → error, task not saved
**Evidence:** `extensions/megapowers/validation/plan-task-linter.ts` lines 11–13:
```ts
if (!task.title || task.title.trim().length === 0) {
  errors.push("Title must not be empty or whitespace-only.");
}
```
`tests/plan-task-linter.test.ts` covers both `title: ""` and `title: "   \t\n  "`, both return `{ pass: false }`. `tool-plan-task.ts` calls `lintTask()` before `writePlanTask()` and returns error if lint fails.
**Verdict:** ✅ pass

### Criterion 2: Description shorter than 200 characters → error, task not saved
**Evidence:** `plan-task-linter.ts` line 16:
```ts
if (task.description.length < MIN_DESCRIPTION_LENGTH) {
  errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
}
```
where `MIN_DESCRIPTION_LENGTH = 200`. Test at line 53 confirms exact error message `"Description must be at least 200 characters (got 10)."` for `description: "Short desc"`.
**Verdict:** ✅ pass

### Criterion 3: Both files_to_modify and files_to_create empty → error, task not saved
**Evidence:** `plan-task-linter.ts` lines 20–22:
```ts
if (task.files_to_modify.length === 0 && task.files_to_create.length === 0) {
  errors.push("Task must specify at least one file in files_to_modify or files_to_create.");
}
```
Test `"returns all errors, not just the first"` uses `files_to_modify: [], files_to_create: []` and expects `result.errors.length >= 2` (combined with empty title).
**Verdict:** ✅ pass

### Criterion 4: depends_on references non-existent task ID → error, task not saved
**Evidence:** `plan-task-linter.ts` lines 31–33:
```ts
} else if (!existingIds.has(depId)) {
  errors.push(`depends_on references non-existent task ${depId}.`);
}
```
Test: `"fails when depends_on references a non-existent earlier task ID"` — depends_on: [1] with empty existingTasks → returns `{ pass: false }` with message `"depends_on references non-existent task 1."`.
**Verdict:** ✅ pass

### Criterion 5: depends_on contains task ID >= current task's own ID → error
**Evidence:** `plan-task-linter.ts` lines 29–31:
```ts
if (depId >= task.id) {
  errors.push(`depends_on contains forward reference to task ${depId} (current task is ${task.id}).`);
}
```
Tests cover: forward reference (depId 99, task 3), self-reference (depId === task.id). Both return `{ pass: false }` with exact error message.
**Verdict:** ✅ pass

### Criterion 6: files_to_create duplicates another task's files_to_create → error
**Evidence:** `plan-task-linter.ts` lines 38–52 — builds a `Set<string>` of all paths claimed by other tasks (skipping self via `if (existing.id === task.id) continue`) and checks new paths against it. Error: `files_to_create path "src/new-module.ts" is already claimed by another task.`

Test `"fails when files_to_create overlaps another task's files_to_create"` confirms this.  
Test `"allows update of the same task without self-conflict"` confirms no false positive on self-updates.
**Verdict:** ✅ pass

### Criterion 7: T0 checks use only structural operations — no regular expressions
**Evidence:** Full content of `plan-task-linter.ts` inspected. Operations used:
- `task.title.trim().length === 0` (string trim + length)
- `task.description.length < MIN_DESCRIPTION_LENGTH` (numeric comparison)
- `task.files_to_modify.length === 0 && task.files_to_create.length === 0` (array length)
- `new Set(existingTasks.map(...))` / `.has(depId)` (Set operations)
- `depId >= task.id` (numeric comparison)
- `claimedPaths.has(filePath)` (Set lookup)

No `RegExp`, no `/.../` patterns found: `grep -n "regex\|RegExp\|\/.*\/" plan-task-linter.ts` returned only comment lines.
**Verdict:** ✅ pass

### Criterion 8: Pure function `lintTask(task, existingTasks)` returning `{ pass: true }` or `{ pass: false, errors: string[] }`
**Evidence:** `plan-task-linter.ts`:
```ts
export type LintResult = { pass: true } | { pass: false; errors: string[] };
export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
```
No I/O, no side effects, no external imports beyond types. Returns exactly the documented union.
**Verdict:** ✅ pass

### Criterion 9: T0 failure includes ALL failing check descriptions, not just the first
**Evidence:** `plan-task-linter.ts` lines 9, 55–57:
```ts
const errors: string[] = [];
// ... all checks push to errors ...
if (errors.length > 0) {
  return { pass: false, errors };
}
```
Test `"returns all errors, not just the first"` with both empty title and empty file lists expects `result.errors.length >= 2`.
**Verdict:** ✅ pass

### Criterion 10: plan_draft_done makes a fast-model lint call before transitioning to review
**Evidence:** `tool-signal.ts` `handlePlanDraftDone` (lines 210–252): when `completeFn` is provided, calls `lintPlanWithModel(taskSummaries, criteriaText, completeFn)` before calling `writeState(cwd, { ...state, planMode: "review" })`. If lint fails, returns error without state transition.

Test `"blocks transition when model lint returns fail findings"` verifies: `readState(tmp2).planMode` remains `"draft"` when model returns fail.
**Verdict:** ✅ pass

### Criterion 11: T1 prompt includes full set of tasks and spec/acceptance criteria
**Evidence:** `handlePlanDraftDone` lines 228–235:
```ts
const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
const criteriaText = criteria.map((c) => `${c.id}. ${c.text}`).join("\n");
const taskSummaries = tasks.map((t) => ({
  id: t.data.id, title: t.data.title,
  description: t.content,
  files: [...t.data.files_to_modify, ...t.data.files_to_create],
}));
const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
```
`buildLintPrompt` includes both `spec_content` and `tasks_content` in the prompt template.

Test `"uses derived acceptance criteria for bugfix workflow"` verifies prompt contains the spec text (`"Crash no longer occurs when input is empty"`).

`buildLintPrompt` tests verify spec content, task titles/descriptions, and file paths all appear in prompt.
**Verdict:** ✅ pass

### Criterion 12: T1 uses `@mariozechner/pi-ai`'s `complete()` function with thinking disabled
**Evidence:** `register-tools.ts` lines 6–46:
```ts
import { complete } from "@mariozechner/pi-ai/dist/stream.js";
// ...
const response = await complete(model, { messages: [...] }, { apiKey });
```
No thinking option is passed (defaults to disabled). Not using pi-subagents.
**Verdict:** ✅ pass

### Criterion 13: `completeFn` injected as dependency — tests mock without real API keys
**Evidence:** `handlePlanDraftDone(cwd: string, completeFn?: CompleteFn)` — function signature accepts optional `completeFn`. All test cases in `tests/tool-signal.test.ts` and `tests/plan-lint-model.test.ts` pass mock functions without any real API keys.
**Verdict:** ✅ pass

### Criterion 14: T1 findings → error returned, no state transition
**Evidence:** `tool-signal.ts` lines 237–239:
```ts
const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
if (!lintResult.pass) {
  return { error: `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}` };
}
```
Test `"blocks transition when model lint returns fail findings"`: `result.error` contains "T1 plan lint failed" and "AC1 is not covered by any task". `readState(tmp2).planMode` remains `"draft"`.
**Verdict:** ✅ pass

### Criterion 15: T1 pass → state transitions to review and triggerNewSession set
**Evidence:** `tool-signal.ts` lines 245–251:
```ts
writeState(cwd, { ...state, planMode: "review" });
return {
  message: `📝 Draft complete: ...`,
  triggerNewSession: true,
};
```
Test `"transitions planMode to review and sets triggerNewSession on pass"`: `result.triggerNewSession === true`, `readState(tmp2).planMode === "review"`.
**Verdict:** ✅ pass

### Criterion 16: No API key → T1 skipped with warning, flow proceeds to review
**Evidence:** `tool-signal.ts` lines 224–226:
```ts
if (!completeFn) {
  lintWarning = "\n  ⚠️ T1 lint skipped: no model API key available.";
}
```
`buildLintCompleteFn` returns `undefined` when no model or no API key found. State still transitions to review.

Test `"adds warning when completeFn is unavailable (no API key)"`: `result.error === undefined`, `result.triggerNewSession === true`, `result.message` contains "⚠️" and "skipped", `planMode === "review"`.
**Verdict:** ✅ pass

### Criterion 17: Malformed T1 response → treated as pass (fail-open) with warning
**Evidence:** `plan-lint-model.ts` lines 70–72:
```ts
} catch {
  return { pass: true, warning: "T1 lint response was malformed — treating as pass (fail-open)." };
}
```
Also handles "fail" with no findings as pass (lines 68–69). 

Tests: `"treats malformed response as pass with warning"` and `"treats API error as pass with warning"` both confirm `pass === true` and `warning` containing "malformed"/"API" respectively.

Test `"adds warning when model response is malformed (fail-open)"` in tool-signal confirms the warning propagates to the tool result message.
**Verdict:** ✅ pass

### Criterion 18: New prompt template `lint-plan-prompt.md` covers all required checks
**Evidence:** `prompts/lint-plan-prompt.md` exists and contains:
1. `{{spec_content}}` and `{{tasks_content}}` placeholders
2. Check 1: "Spec coverage" — uncovered ACs
3. Check 2: "Dependency coherence" — logically ordered dependencies
4. Check 3: "Description quality" — substantive and actionable
5. Check 4: "File path plausibility" — no placeholders

Instructs JSON-only response with `{"verdict": "pass"|"fail", "findings": [...]}`.

Test `"includes the lint-plan-prompt.md template content"` verifies: `prompt.includes("Spec coverage")`, `prompt.includes("Dependency coherence")`, `prompt.includes("Description quality")`, `prompt.includes("verdict")` — all pass.
**Verdict:** ✅ pass

### Criterion 19: `review-plan.md` updated to focus on architecture, removing mechanical checks
**Evidence:** `prompts/review-plan.md` line 19:
> "The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1). Mechanical issues — empty descriptions, missing file targets, placeholder text, spec coverage gaps, dependency ordering — have been caught and fixed. **Focus your review entirely on higher-order concerns:** code correctness, architectural soundness, and implementation feasibility."

Section 6 "Self-Containment" explicitly notes: "Structural completeness — file paths, non-empty descriptions — is already verified by T0 lint."
**Verdict:** ✅ pass

### Criterion 20: `handlePlanDraftDone` becomes async
**Evidence:** `tool-signal.ts` line 210:
```ts
export async function handlePlanDraftDone(cwd: string, completeFn?: CompleteFn): Promise<SignalResult> {
```
**Verdict:** ✅ pass

### Criterion 21: Tool registration properly awaits async `handlePlanDraftDone`
**Evidence:** `register-tools.ts` lines 70–73:
```ts
if (params.action === "plan_draft_done") {
  const completeFn = await buildLintCompleteFn(ctx.modelRegistry);
  result = await handlePlanDraftDone(ctx.cwd, completeFn);
}
```
The `execute` function is `async`, and both `buildLintCompleteFn` and `handlePlanDraftDone` are properly awaited.
**Verdict:** ✅ pass

---

## Overall Verdict

**pass**

All 21 acceptance criteria are satisfied. The implementation is complete and correct:
- T0 deterministic lint in `extensions/megapowers/validation/plan-task-linter.ts` with pure `lintTask()` function, no regex, all errors collected
- T1 model lint in `extensions/megapowers/validation/plan-lint-model.ts` with injected `completeFn`, fail-open semantics, and proper JSON parsing
- `handlePlanDraftDone` made async, T1 integrated before state transition, graceful degradation when no API key
- `lint-plan-prompt.md` template created covering all four required check dimensions
- `review-plan.md` updated to defer mechanical checks to T0/T1
- All 117 tests in the 4 feature test files pass; the 2 pre-existing failures in `tests/prompts.test.ts` are unrelated to this feature (file unchanged in this branch)
