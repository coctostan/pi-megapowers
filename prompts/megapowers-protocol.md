## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "phase_next" }` — Advance to the next workflow phase
- `{ action: "phase_back" }` — Go back one phase using workflow-defined backward transitions (review→plan, verify→implement, code-review→implement)
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
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
