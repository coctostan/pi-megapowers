# Megapowers Operation Feedback

This page documents the shared status vocabulary and result-message shape used by Megapowers tool handlers — `handleSignal`, `handlePlanTask`, `handlePlanReview`, `handlePlanDraftDone`, and `handleCloseIssue` — and the convention new megapowers tools should adopt.

## Status vocabulary

Defined in `extensions/megapowers/feedback.ts` as `ICONS`:

| Key       | Icon | When to use                                                |
|-----------|------|------------------------------------------------------------|
| `success` | ✅   | An action completed successfully.                          |
| `info`    | 📋   | An informational / coordination event (e.g. phase advance).|
| `warn`    | ⚠️   | Something happened that needs attention but is not an error (e.g. rework, iteration cap). |
| `error`   | ❌   | An action failed.                                          |
| `note`    | 📝   | A neutral status note (e.g. draft saved).                  |

The deprecated `review_approve` action is not part of this vocabulary and is never advertised by any tool.

## Result-message shape

Compose result messages via `composeMessage({ icon, summary, changes?, artifactPath?, nextStep? })`. Output shape:

```text
<ICON> <summary>
  • <change-1>
  • <change-2>
  → <artifactPath>
  Next: <nextStep>
```

- `summary` — single-line "what changed" phrase.
- `changes` — optional list of specific fields / counts that changed.
- `artifactPath` — relative path under `.megapowers/plans/<slug>/` when an artifact was written or updated.
- `nextStep` — explicit next action for the agent / user.

## Tool conventions

| Tool                         | Icon on success | Required content                                       |
|------------------------------|-----------------|--------------------------------------------------------|
| `task_done`                  | ✅              | Completed task id+description, remaining count, next task or auto-advance phrase. |
| `phase_next`                 | 📋              | New phase name + explicit next-step.                   |
| `phase_back`                 | ⚠️              | New phase name + rework / next-step phrase.            |
| `tests_failed`               | ✅              | RED recorded + production writes now allowed.          |
| `tests_passed`               | ✅              | GREEN recorded.                                        |
| `plan_draft_done`            | 📋              | Task count + transition to review mode.                |
| `close_issue`                | ✅              | Closed slug + source-issues-closed count when applicable. |
| `plan_task` (create/update)  | ✅              | Task id+title, artifact path, fields set / changed.    |
| `plan_review` (approve)      | ✅              | Iteration, approved count, generated `plan.md` path, advance to implement. |
| `plan_review` (revise)       | 📋              | Iteration, approved IDs, needs-revision IDs, transition to revise mode. |

## Errors

Error messages must:
- Begin with `❌`.
- Name the failing action (e.g. `plan_task`, `plan_review`).
- Name the corrective action (e.g. `provide title`, `fix lint errors`, `submit during plan review`, `write revise-instructions file before revise verdict`, `delete and recreate corrupt task`).

## Adding new megapowers tools

New tools must:
1. Import `composeMessage` and `ICONS` from `extensions/megapowers/feedback.ts`.
2. Return `{ message }` / `{ error }` composed via `composeMessage`.
3. Include the saved artifact path whenever a file under `.megapowers/plans/<slug>/` is written or updated.
4. Make the next-step explicit.
5. Never advertise the deprecated `review_approve` action.
