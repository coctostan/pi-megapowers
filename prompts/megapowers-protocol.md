## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "phase_next" }` — Advance to the next workflow phase
- `{ action: "phase_back" }` — Go back to the previous phase (feature workflow only). Resolves the first `backward` transition from the current phase: verify→implement, code-review→implement, review→plan. Returns an error if no backward transition exists from the current phase.
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
- `{ action: "tests_failed" }` — Signal that tests failed (RED in TDD cycle — unlocks production code writes)
- `{ action: "tests_passed" }` — Signal that tests passed (GREEN in TDD cycle)

### `megapowers_save_artifact`
Call this to save phase output:
- `{ phase: "<phase>", content: "<full content>" }` — Save artifact for the current phase
- Valid phases: `brainstorm`, `spec`, `plan`, `reproduce`, `diagnosis`, `verify`, `code-review`, `learnings`
- Always save your work before advancing to the next phase

### Version Control
Version control is managed automatically via jj. **Do not run jj or git commands.** Phase changes, bookmarks, and commits are handled by the system.

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly. Do NOT edit `.megapowers/state.json`.
