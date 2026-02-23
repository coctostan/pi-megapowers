## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this to signal state transitions:
- `{ action: "task_done" }` — Mark the current implementation task as complete
- `{ action: "review_approve" }` — Approve the plan during review phase
- `{ action: "phase_next" }` — Advance to the next workflow phase

### `megapowers_save_artifact`
Call this to save phase output:
- `{ phase: "<phase>", content: "<full content>" }` — Save artifact for the current phase

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call
Do NOT work around errors by editing state files directly.
