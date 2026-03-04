# Code Review — Issue 088: Use Individual Task Files Instead of plan.md

## Files Reviewed

- `extensions/megapowers/workflows/types.ts` — Added `RequireTaskFilesGate` interface and union member
- `extensions/megapowers/workflows/gate-evaluator.ts` — Added `requireTaskFiles` case using `listPlanTasks`
- `extensions/megapowers/workflows/feature.ts` — Changed plan→implement gate from `requireArtifact plan.md` to `requireTaskFiles`
- `extensions/megapowers/workflows/bugfix.ts` — Same gate change
- `extensions/megapowers/subagent/pipeline-tool.ts` — Replaced `plan.md`/`extractTaskSection` with `readPlanTask`; dead code left in place per spec
- `extensions/megapowers/subagent/task-deps.ts` — Updated "no tasks found" error message
- `extensions/megapowers/tools/tool-signal.ts` — Updated "no tasks found" error message (task_done and plan_draft_done paths)
- `tests/gate-evaluator.test.ts` — New `requireTaskFiles` describe block (2 tests)
- `tests/pipeline-tool.test.ts` — New tests for task file body and missing task file; existing tests updated to write task files
- `tests/task-deps.test.ts` — New test verifying error message references task files
- `tests/workflow-configs.test.ts` — Updated gate assertions for feature and bugfix
- `tests/gates.test.ts` — Updated plan→implement gate tests
- `tests/phase-advance.test.ts` — Updated tests to write task files alongside plan.md; updated assertion message
- `tests/commands-phase.test.ts` — Updated `seed()` to write a task file
- `tests/reproduce-090.test.ts` — Updated tests to write task files

## Strengths

- **Minimal, targeted changes.** Only the files that needed to change were modified. No speculative refactoring.
- **`gate-evaluator.ts:57–64`** — `requireTaskFiles` correctly re-uses `listPlanTasks`, which already handles the non-existent directory case with an early `[]` return. No duplicated directory-check logic.
- **`pipeline-tool.ts:83–90`** (post-fix) — The `readPlanTask` check is placed before workspace creation. This means no orphaned git worktrees are created when the task file is missing or malformed.
- **Test quality.** The `pipeline-tool.test.ts` test at line 85 (`"uses task file body as planSection context instead of plan.md"`) writes *both* a `plan.md` with a distinct `PLAN_MD_MARKER` and a task file with `TASK_FILE_BODY_MARKER`, then asserts the implementer receives only the task file body. This correctly rules out the old code path rather than just testing the happy path.
- **Backward compatibility preserved.** `deriveTasks` fallback to `plan.md` and `legacy-plan-bridge.ts` are untouched. The `requireTaskFiles` gate only guards plan→implement; already-running plans remain unaffected.
- **Error messages are actionable.** Both `tool-signal.ts` and `task-deps.ts` error messages give the specific tasks directory path, so users know exactly where to look.

## Findings

### Critical
None.

### Important

**`pipeline-tool.ts:84` — Conflated null/error return produces misleading error message** *(FIXED)*

The original code:
```ts
if (!taskDoc || "error" in taskDoc) {
  return { error: `Task ${task.index} task file not found. ...` };
}
```
collapsed `null` (file does not exist) and `{ error: string }` (file exists but frontmatter/schema parse failed) into the same message "task file not found". A task file with malformed YAML or a missing required field would report "not found" even though the file was present, wasting debugging time.

**Fix applied:** Split into two distinct branches — `null` → "not found", `{ error }` → "malformed: `<parse error detail>`". A corresponding test (`"returns descriptive error when task file exists but is malformed"`) was added to `tests/pipeline-tool.test.ts`.

### Minor

**`pipeline-tool.ts:28–41` — Dead local function `extractTaskSection`**

`extractTaskSection` is a private (non-exported) local function in `pipeline-tool.ts` that was the previous mechanism for extracting task content from `plan.md`. It is no longer called anywhere in the file. The spec explicitly marks removal of `extractTaskSection` as out of scope ("may have other callers or future use"), though this note appears to target the shared `extractPlanTasks` utility in `plan-parser.ts` rather than this file-local copy (which has no callers at all). Left as-is per spec intent, but worth removing in a future cleanup PR.

**`pipeline-tool.ts:76` — "not found in plan" wording persists for deriveTasks mismatch**

```ts
if (!task) return { error: `Task ${input.taskIndex} not found in plan.` };
```
This error fires when `deriveTasks` returns tasks but the requested `taskIndex` isn't in the list. The word "plan" is slightly ambiguous (does it mean `plan.md`? the task file list?). Not a functional issue, and not covered by spec criteria. Minor wording note for a future pass.

## Recommendations

1. **Remove `extractTaskSection` from `pipeline-tool.ts`** in a follow-up cleanup PR. It's a 14-line private function with no callers; leaving dead code risks future confusion about whether it's supposed to be wired back in.
2. **Consider `noUnusedLocals: true` in `tsconfig.json`** to surface dead private functions automatically. Would have flagged the above without needing a code review.

## Assessment

**ready**

All 11 acceptance criteria verified. One important bug (conflated null/error in `readPlanTask` check → misleading error message) was found and fixed in this review session, with a new test added. The remaining findings are minor style/wording items. Full test suite passes: **836 pass, 0 fail**.
