# Feature: Individual Task Files as Runtime Source of Truth (#088)

## Summary

Completed the migration to individual task files (`tasks/task-001.md`, etc.) as the sole runtime source of truth for the pipeline tool and the plan→implement gate. Before this change, the pipeline extracted task content by parsing the monolithic `plan.md`; the plan→implement gate also checked for `plan.md` existence. Both are now decoupled from `plan.md`.

## Motivation

The plan authoring system was already storing tasks as individual structured YAML-frontmatter files. However, the pipeline tool ignored those files at runtime and instead re-parsed the monolithic `plan.md`, duplicating data and creating a split source of truth. The `plan.md` gate also meant any issue that authored tasks exclusively via `megapowers_plan_task` (and relied on `legacy-plan-bridge.ts` to generate `plan.md`) had a fragile indirect dependency. This change makes the task-file format the authoritative runtime contract.

## What Changed

### `pipeline-tool.ts` — reads from task files

- Added import for `readPlanTask` from `state/plan-store.ts`
- Replaced `store.readPlanFile(slug, "plan.md")` + `extractTaskSection()` with a direct call to `readPlanTask(projectRoot, activeIssue, task.index)`
- The `planSection` injected into the implementer context is now the task file's markdown body (after frontmatter)
- Error handling distinguishes two failure modes: `null` (task file not found) vs `{ error }` (malformed frontmatter/schema), producing actionable messages for each

### `types.ts` — new gate type

Added `RequireTaskFilesGate` interface and included it in the `GateConfig` discriminated union:

```typescript
export interface RequireTaskFilesGate {
  type: "requireTaskFiles";
}
```

### `gate-evaluator.ts` — evaluates `requireTaskFiles`

New switch case calls `listPlanTasks(cwd, slug)`. Returns:
- `{ pass: true }` when at least one valid task file exists
- `{ pass: false, message: "No task files found in .megapowers/plans/<slug>/tasks/. Use megapowers_plan_task…" }` otherwise

### `feature.ts` / `bugfix.ts` — updated plan→implement gate

Both workflows' plan→implement transition now use `{ type: "requireTaskFiles" }` instead of `{ type: "requireArtifact", file: "plan.md" }`:

```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] }
```

### `tool-signal.ts` / `task-deps.ts` — updated error messages

"No tasks found" errors in `handleTaskDone` and `validateTaskDependencies` now reference `.megapowers/plans/<issue>/tasks/` instead of `plan.md`.

## What Was Preserved

- `legacy-plan-bridge.ts` and `generateLegacyPlanMd()` are unchanged — `plan.md` is still generated during plan approval for backward compatibility
- `deriveTasks()` fallback path (reads `plan.md` for legacy plans) is unchanged
- `extractTaskSection` in `pipeline-tool.ts` is left as dead code per spec (removing shared utilities was out of scope)
- The plan authoring flow (`megapowers_plan_task` / `megapowers_plan_review`) is unchanged

## Tests Added / Updated

| File | Changes |
|---|---|
| `tests/gate-evaluator.test.ts` | New `requireTaskFiles` describe block: pass when files exist, fail with path message when none |
| `tests/pipeline-tool.test.ts` | New: task file body used as planSection (not plan.md); missing task file returns error before workspace creation; malformed task file returns "malformed" error (not "not found") |
| `tests/task-deps.test.ts` | New: empty-tasks error message references task files, not plan.md |
| `tests/tool-signal.test.ts` | New: task_done no-tasks error message references task files |
| `tests/workflow-configs.test.ts` | Updated: feature + bugfix plan→implement gate assertions |
| `tests/gates.test.ts` | Updated: plan→implement tests use `writePlanTask` instead of writing plan.md |
| `tests/phase-advance.test.ts` | Updated: plan→implement tests write task files; gate-failure assertion updated |
| `tests/commands-phase.test.ts` | Updated: `seed()` writes a task file alongside plan.md |
| `tests/reproduce-090.test.ts` | Updated: plan→implement scenarios write task files |

Final test suite: **836 pass, 0 fail**.
