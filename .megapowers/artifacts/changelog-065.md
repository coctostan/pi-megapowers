## [Unreleased]

### Added
- **Done phase sequential action runner** — Refactored done phase from `onAgentEnd` message-scraping to a tool-driven model. The LLM executes wrap-up actions (docs, changelog, learnings, VCS, project docs) using existing tools, calling `task_done` after each. (#065)
- **`completedDoneActions` state tracking** — New `completedDoneActions: string[]` field tracks completed done-phase actions. Reset on every phase transition. Persisted via `KNOWN_KEYS`. (#065)
- **`handleSaveArtifact` learnings phase** — `megapowers_save_artifact({ phase: "learnings" })` parses markdown bullet lists and routes to `store.appendLearnings()`. Errors on empty content. (#065)
- **Close-confirmation dialog** — After the last done-phase `task_done`, a dialog asks to close the issue. Batch issues close source issues first. Dismiss keeps user in done phase. (#065)
- **`update-project-docs` done action** — New required action reviews and updates ROADMAP.md, AGENTS.md, README.md as needed. (#065)
- **`vcs-wrap-up` done action** — Replaces `squash-task-changes` with full VCS wrap-up (squash, bookmark, push, PR). Shown only when `taskJJChanges` has entries. (#065)
- **Locked checklist items** — `DoneChecklistItem.locked` field prevents toggling required actions in the done checklist UI. (#065)
- **Conditional VCS permission in done prompt** — Done-phase prompt includes `jj`/`git`/`gh` bash permission only when `vcs-wrap-up` is active. (#065)

### Changed
- **Status bar done-phase progress** — Shows `"N/M actions complete"` instead of `"→ N actions"`. (#065)
- **Dashboard done-phase display** — Shows progress fraction and next action name instead of action list with "send" instruction. (#065)
- **Done-phase prompt** — Shows completed actions with ✅ prefix; pending actions listed plainly. Per-action instructions in `prompts/done.md`. (#065)

### Removed
- **`onAgentEnd` artifact-capture block** — Deleted message-scraping logic that parsed assistant messages in done phase. Dashboard rendering preserved. (#065)
- **`close-issue` checklist item** — Issue closing handled by close-confirmation dialog instead. (#065)
- **`squash-task-changes` action** — Replaced by `vcs-wrap-up`. (#065)
