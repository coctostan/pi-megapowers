# Feature: Two-Tier Plan Validation

**Issue:** 092  
**Date:** 2026-03-06  
**Status:** Shipped

## What Was Built

Added two pre-screening validation tiers to the plan authoring loop, inserted before the expensive deep-review session break (T2):

- **T0 — Deterministic per-task lint** (`megapowers_plan_task`): a pure `lintTask()` function that validates every task on save — no API calls, no latency.
- **T1 — Fast-model whole-plan lint** (`plan_draft_done`): a Haiku-4-5 call that checks spec coverage, dependency coherence, description quality, and file path plausibility before transitioning to review mode.

## Why

Plan review (T2) requires a session break — the LLM transitions to a fresh session, a human reviews the output, and then the deep-review session starts. If a plan has mechanical errors (empty description, missing file targets, uncovered ACs), those errors could have been caught instantly and locally. Two pre-screens eliminate most iteration cycles before the expensive T2 break.

## Architecture

```
megapowers_plan_task called
  → lintTask(task, existingTasks)         ← T0: pure fn, no I/O
      checks: title, description ≥200 chars, ≥1 file, depends_on validity, no duplicate files_to_create
      returns { pass: true } | { pass: false, errors: string[] }
  → if pass: writePlanTask() (save to disk)
  → if fail: return aggregated error (all checks, not just first)

megapowers_signal({ action: "plan_draft_done" })
  → buildLintCompleteFn(modelRegistry)    ← builds Haiku-4-5 completeFn (or undefined if no API key)
  → handlePlanDraftDone(cwd, completeFn)
      if completeFn missing: skip T1, warn, proceed to review
      if completeFn present:
        → buildLintPrompt(tasks, specCriteria) using lint-plan-prompt.md template
        → completeFn(prompt) → parseModelResponse(text)
          fail-open: API error, malformed JSON → treat as pass + warning
          "fail" with findings → return error, no state transition
          "pass" → proceed
      → writeState(planMode: "review"), triggerNewSession: true
```

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/validation/plan-task-linter.ts` | **New** — `lintTask()` pure function + types |
| `extensions/megapowers/validation/plan-lint-model.ts` | **New** — `lintPlanWithModel()`, `buildLintPrompt()`, `parseModelResponse()` |
| `extensions/megapowers/tools/tool-plan-task.ts` | **Modified** — T0 lint integrated into create + update paths |
| `extensions/megapowers/tools/tool-signal.ts` | **Modified** — `handlePlanDraftDone` exported, made async, T1 integrated |
| `extensions/megapowers/register-tools.ts` | **Modified** — `buildLintCompleteFn`, async `plan_draft_done` dispatch |
| `prompts/lint-plan-prompt.md` | **New** — T1 model instruction template |
| `prompts/review-plan.md` | **Modified** — mechanical checks removed, focused on architecture |
| `tests/plan-task-linter.test.ts` | **New** — 34 tests for `lintTask()` |
| `tests/plan-lint-model.test.ts` | **New** — 11 tests for T1 model lint |
| `tests/tool-plan-task.test.ts` | **Modified** — T0 integration tests added |
| `tests/tool-signal.test.ts` | **Modified** — T1 integration tests, graceful degradation |

## Key Design Decisions

**T0 is purely structural, no regex.** All checks use string length, array length, Set operations, and numeric comparisons. No regular expressions — consistent with the "fast and deterministic" requirement.

**completeFn injection.** `handlePlanDraftDone` accepts an optional `completeFn?: (prompt: string) => Promise<string>`. Production wires a real Haiku-4-5 call; tests pass mocks. Zero API key dependency in tests.

**Fail-open for T1.** API errors, malformed JSON, and "fail with no findings" all return `pass: true` with a warning. T1 is a convenience screen, not a gate — it should never permanently block progress due to model issues.

**T1 skipped gracefully when no API key.** `buildLintCompleteFn` returns `undefined` if no Haiku model is configured or the API key is missing. `handlePlanDraftDone` checks for `undefined` and appends a warning to the result message instead of blocking.

## Bug Fixed During Code Review

The plan task import `"@mariozechner/pi-ai/dist/stream.js"` caused an extension load failure in production. The pi-coding-agent's bundled `@mariozechner/pi-ai` has a strict `exports` map — no `./dist/stream.js` subpath is exported. Fixed to `"@mariozechner/pi-ai"` (the `.` export re-exports everything including `complete`).

## Test Coverage

- 117 new/updated tests across 4 files
- All 21 acceptance criteria verified
- Fail-open semantics tested at every layer (API error, malformed JSON, no API key)
- Self-update non-conflict verified (task updating itself doesn't trigger `files_to_create` conflict)
