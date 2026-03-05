## Megapowers Protocol

You have access to these megapowers tools:

### `megapowers_signal`
Call this for workflow/TDD signals:
- `{ action: "phase_next" }` — Advance to the next workflow phase (when allowed by gates)
- `{ action: "phase_back" }` — Move back via workflow-defined backward transitions (e.g. verify→implement, code-review→implement)
- `{ action: "task_done" }` — Mark the current implementation task complete
- `{ action: "tests_failed" }` — Record RED in TDD (unlocks production writes)
- `{ action: "tests_passed" }` — Record GREEN in TDD
- `{ action: "plan_draft_done" }` — Submit plan draft/revision for review (plan mode: draft/revise → review)
- `{ action: "close_issue" }` — Mark the active issue as done and reset state (done phase only — call after all wrap-up actions are complete)

Do **not** use `{ action: "review_approve" }` (deprecated).

### `megapowers_plan_task`
Use this during plan **draft/revise** mode to create/update structured plan tasks.

### `megapowers_plan_review`
Use this during plan **review** mode to submit verdict:
- `{ verdict: "approve", ... }` — approves plan and advances to implement
- `{ verdict: "revise", ... }` — requests revisions and returns to revise mode

Do not bypass plan review by forcing `phase_next` from plan.

### Artifact Persistence
Save phase output by writing files directly under `.megapowers/plans/<issue-slug>/` using `write` (or `edit` for incremental updates).
- Example: `.megapowers/plans/<issue-slug>/spec.md`
- Always save work before advancing phases

### Version Control
Git is the underlying VCS. Read-only operations (`git status`, `git log`, `git diff`) are fine. Do not run ad-hoc `git commit`, `git push`, `git branch`, `git checkout`, or `git merge` outside of designated workflow moments. The system automatically creates a feature branch on issue activation and WIP-commits when switching issues. **Exception:** in the done phase, `push-and-pr` and post-merge cleanup (`git checkout main`, `git pull`, `git branch -d`) are expected and should be executed directly. Pipeline/subagent worktrees are also managed automatically.

### Error Handling
When a megapowers tool returns an error:
1. READ the error message — it tells you exactly what's wrong
2. FIX the issue described
3. RETRY the tool call

Do NOT work around errors by editing state files directly. Do NOT edit `.megapowers/state.json`.
