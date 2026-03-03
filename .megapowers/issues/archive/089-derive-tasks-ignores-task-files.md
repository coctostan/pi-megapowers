---
id: 89
type: bugfix
status: done
created: 2026-03-02T00:00:00.000Z
---

# deriveTasks only reads legacy plan.md, ignores task files

## Symptom

In the implement phase, the system reports 0 tasks found. `currentTaskIndex` stays at 0, no tasks are presented to the LLM, and the `allTasksComplete` gate (for implement → verify) may pass vacuously or fail with "No plan tasks found."

## Observed in

pi-hashline-readmap project, issue 022-exploratory-testing-bug-fixes:
- 6 task files exist in `.megapowers/plans/022-exploratory-testing-bug-fixes/tasks/` (task-001.md through task-006.md)
- `plan.md` exists but uses `## Task N —` format (manually written during draft)
- `extractPlanTasks(plan.md)` returns `[]` — the parser expects `### Task N:` (triple hash, colon) but the file uses `## Task N —` (double hash, em-dash)
- Result: implement phase has no tasks to work on

## Root Cause

Two compounding issues:

### Issue A: `deriveTasks` only reads plan.md, ignores task files

`deriveTasks()` in `extensions/megapowers/state/derived.ts` reads only `plan.md` using the legacy markdown parser. The new plan system stores tasks as individual frontmatter files (`tasks/task-001.md`, etc.) managed by `plan-store.ts` (`listPlanTasks`, `readPlanTask`, `writePlanTask`). But `deriveTasks` never reads these files.

When `handleApproveVerdict` runs (the happy path), it calls `generateLegacyPlanMd(tasks)` which produces a plan.md in the correct `### Task N:` format. So normally this works. But when the approve path is bypassed (see issue #088), `generateLegacyPlanMd` never runs, and plan.md contains whatever the LLM wrote during draft — which uses a different format.

### Issue B: `extractPlanTasks` only matches `### Task N:` format

The parser in `plan-parser.ts` matches `### Task N: Title`. Common LLM output formats that don't match:
- `## Task 1 — Description` (double hash, em-dash)
- `## Task 1: Description` (double hash)
- `### Task 1 — Description` (triple hash, em-dash instead of colon)

## Impact

- Implement phase has no tasks → LLM has no structured work to do
- `allTasksComplete` gate may behave unpredictably with 0 tasks
- `currentTaskIndex` is meaningless
- TDD guard can't track per-task state
- This bug is **dependent on issue #088** — only surfaces when `phase_next` bypasses the approve path

## Affected Files

| File | Issue |
|------|-------|
| `extensions/megapowers/state/derived.ts` | `deriveTasks` only reads plan.md, not task files |
| `extensions/megapowers/plan-parser.ts` | `extractPlanTasks` format matching too strict |
| `extensions/megapowers/workflows/gate-evaluator.ts` | `allTasksComplete` gate calls `deriveTasks` — returns 0 tasks |

## Fix Direction

**Primary fix:** `deriveTasks` should prefer task files when they exist, falling back to plan.md parsing.

**Secondary fix:** Make `extractPlanTasks` more lenient — accept `##` or `###` and `—`/`-` or `:` as separators.

**Note:** Fixing issue #088 (adding a proper gate) would prevent the bypass path that causes this to surface. But `deriveTasks` should still be updated for defense-in-depth — task files are the canonical source of truth in the new system.
