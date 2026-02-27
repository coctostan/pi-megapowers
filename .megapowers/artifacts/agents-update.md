# AGENTS.md updates for #065

## Changes needed:

### State Architecture section
Update `state.json` field list to include `doneActions`, `completedDoneActions`:
> `state.json` stores only coordination data: `activeIssue`, `workflow`, `phase`, `currentTaskIndex`, `completedTasks[]`, `reviewApproved`, `tddTaskState`, `doneActions`, `completedDoneActions`, `megaEnabled`.

### Custom Tools section  
Update signal tool description to include done-phase actions:
> - **`megapowers_signal`** — state transitions: `task_done`, `review_approve`, `phase_next`, `tests_failed`, `tests_passed`. In done phase, `task_done` advances the action queue.
> - **`megapowers_save_artifact`** — persist phase artifacts to disk. Phase `"learnings"` routes to `appendLearnings()`.

### Key Concepts section
Add:
> - **Done phase actions**: tool-driven wrap-up actions (docs, changelog, learnings, project docs, VCS). Required actions are locked in the checklist UI. Close-confirmation dialog triggers after all actions complete.

### Tests section
Update count:
> `bun test` — 705 tests across 36 files.

### Known Issues section
Add:
> - **Done-phase write policy**: done phase is `blocking: true`, so wrap-up actions that write docs/changelog must stage in `.megapowers/` and apply post-close.

Note: Cannot directly edit AGENTS.md during done phase (write policy). Apply after issue close.
