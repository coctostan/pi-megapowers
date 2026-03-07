# Diagnosis

## Root Cause

Issue #110 (commit `0ec65b9`) intentionally scoped its fix to **disconnect T1 from runtime** — removing the `completeFn` parameter from `handlePlanDraftDone`, deleting the `buildLintCompleteFn` function from `register-tools.ts`, and removing the model-lint import. It deliberately left the T1 module, prompt, and tests in place, deferring deletion to issue #101.

The result is three entirely dead files and one orphaned test block that exercises phantom behavior:

1. **`extensions/megapowers/validation/plan-lint-model.ts`** — exports `lintPlanWithModel`, `buildLintPrompt`, `CompleteFn`, `ModelLintResult`. Zero imports from any other file in the codebase.
2. **`prompts/lint-plan-prompt.md`** — loaded only by `plan-lint-model.ts:43` via `loadPromptFile("lint-plan-prompt.md")`. Zero other references.
3. **`tests/plan-lint-model.test.ts`** — 8 tests exercising the dead module. Imports only from the dead module.
4. **`tests/tool-signal.test.ts:865-905`** — `describe("handlePlanDraftDone — no T1 model gating")` passes a `failFn` to `handlePlanDraftDone` via an `as any` cast. Since `handlePlanDraftDone(cwd: string)` no longer accepts a second parameter, the `failFn` is silently ignored by JavaScript. The test passes but tests nothing meaningful.

## Trace

1. **Origin:** Commit `6dabbd9` (issue #092) created all four T1 assets.
2. **Disconnection:** Commit `0ec65b9` (issue #110) removed:
   - `buildLintCompleteFn()` from `register-tools.ts`
   - `import { lintPlanWithModel, type CompleteFn }` from `tool-signal.ts`
   - The `completeFn?: CompleteFn` parameter from `handlePlanDraftDone`
   - The entire T1 lint logic block inside `handlePlanDraftDone`
3. **Left behind:** The three T1 source files and the `no T1 model gating` test block.

## Affected Code

| File | Status | Action |
|------|--------|--------|
| `extensions/megapowers/validation/plan-lint-model.ts` | Dead — zero imports | Delete |
| `prompts/lint-plan-prompt.md` | Dead — loaded only by dead module | Delete |
| `tests/plan-lint-model.test.ts` | Dead — tests dead module | Delete |
| `tests/tool-signal.test.ts:865-905` | Orphaned — tests phantom param | Delete block |

## Pattern Analysis

The `validation/` directory still contains `plan-task-linter.ts` (T0), which IS actively imported:
```
$ grep -rn "plan-task-linter" extensions/ --include="*.ts" | grep -v ".megapowers/"
extensions/megapowers/tools/tool-plan-task.ts:4:import { lintTask } from "../validation/plan-task-linter.js";
```
T0 stays. Only T1 (`plan-lint-model.ts`) is dead.

The negative assertions in `tests/register-tools.test.ts:71,73` (`expect(source).not.toContain("buildLintCompleteFn")` and `expect(source).not.toContain('import type { CompleteFn }...')`) will continue to pass after deletion — they verify absence, not presence.

Existing `plan_draft_done` test coverage (lines 266-331) already covers all required paths:
- Wrong phase → error
- Wrong planMode (review) → error
- No task files → error
- draft → review transition
- revise → review transition
- Task count in success message
- triggerNewSession flag

No additional replacement tests are needed — the existing coverage already satisfies AC4.

## Risk Assessment

**Very low risk.** All four deletions remove code that has zero callers:

1. No runtime code imports `plan-lint-model.ts` — verified by grep.
2. No prompt loader references `lint-plan-prompt.md` outside the dead module — verified by grep.
3. The orphaned test block in `tool-signal.test.ts` tests nothing (extra arg silently ignored).
4. The `register-tools.test.ts` negative assertions will remain green.
5. T0 (`plan-task-linter.ts`) is unaffected — different file, actively imported.

## Fixed When

1. `extensions/megapowers/validation/plan-lint-model.ts` does not exist.
2. `prompts/lint-plan-prompt.md` does not exist.
3. `tests/plan-lint-model.test.ts` does not exist.
4. The `handlePlanDraftDone — no T1 model gating` describe block (lines 865-905) is removed from `tests/tool-signal.test.ts`.
5. `grep -rn "plan-lint-model\|lintPlanWithModel\|buildLintPrompt\|ModelLintResult" extensions/ tests/ --include="*.ts"` returns only negative assertions in `register-tools.test.ts`.
6. All existing tests pass (`bun test`).
