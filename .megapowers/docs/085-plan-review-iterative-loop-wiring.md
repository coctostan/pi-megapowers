Done. Here's a summary of what happened:

**4 issues found and fixed:**

1. **`review-plan.md` broken `{{plan_content}}`** — `plan.md` doesn't exist during review mode (it's only generated on approval), so reviewers saw a literal `{{plan_content}}` placeholder. Fixed to instruct them to read task files from disk instead.

2. **Silent corrupt-file overwrite** in `handlePlanTask` — when `readPlanTask` returned `{ error }` (parse failure), code fell through to the create path and silently obliterated the file. Now returns a descriptive error. New regression test added.

3. **Stale "Task 18 wiring" note** in the revise verdict message — development artifact leaking into production user-facing output. Removed.

4. **`megapowers_signal` description** still advertised `review_approve` (deprecated) and `review→plan` (no longer valid). Updated to reflect the new workflow.

Two minor inefficiencies (redundant `planMode: null` cast and double `updateTaskStatuses` on approve path) were noted in the report but left for a future cleanup pass — no correctness impact.