# Pending Changelog Entry for 065-done-phase-refactor

Add the following to `CHANGELOG.md` under `## [Unreleased]`:

```markdown
### Added
- **Done-phase action runner** (`065-done-phase-refactor`) — Replaced fragile `onAgentEnd` message-scraping with a tool-driven sequential action queue. The LLM executes wrap-up actions (docs, changelog, learnings, VCS, project docs) using existing tools, calling `megapowers_signal({ action: "task_done" })` after each one.
- **`completedDoneActions: string[]`** in `MegapowersState` — tracks which done-phase actions have been completed; reset on every phase transition; persisted in `state.json` via `KNOWN_KEYS`.
- **`handleSaveArtifact` accepts phase `"learnings"`** — routes to `store.appendLearnings(issueSlug, entries)` with markdown bullet-list parsing; returns an error if no bullet items are found.
- **`getDoneChecklistItems` `locked` field** — required actions (generate-docs/bugfix-summary, write-changelog, capture-learnings, update-project-docs) have `locked: true`; optional `vcs-wrap-up` has `locked: false`. Checklist UI prevents toggling locked items.
- **`update-project-docs` done action** — reviews and updates ROADMAP.md, AGENTS.md, and README.md as part of every done phase.
- **`vcs-wrap-up` replaces `squash-task-changes`** — combines squash + bookmark + push + PR; shown only when `taskJJChanges` has entries and `jjChangeId` is set.
- **Close-confirmation dialog** — after the last `task_done` in done phase, `handleSignal` returns `closeConfirmation: true` and a `ctx.ui.select` dialog presents "Yes / No". Confirming closes source issues first, then the main/batch issue, then resets state to `createInitialState()`. Dismissing keeps the user in done phase.
- **Status bar and dashboard done-phase progress** — shows `"N/M actions complete"` where N is `completedDoneActions.length` and M is total actions.
- **`getCloseConfirmationInfo`** and **`handleCloseConfirmation`** exported from `tool-signal.ts` for testable close logic.

### Changed
- **`handleTaskDone`** now also succeeds when `state.phase === "done"` and `doneActions` is non-empty, advancing the action queue.
- **Done-phase prompt** (`prompts/done.md`) rewritten — shows ✅ completed actions, lists pending actions, conditionally includes VCS permission block when `vcs-wrap-up` is in `doneActions`.
- **Dashboard done-phase block** — replaces "send any message" instruction with `N/M complete` fraction and "Next: <action>" line.

### Removed
- **`onAgentEnd` artifact-capture block** — deleted from `hooks.ts`. The block that scraped assistant messages to detect done-phase completions is gone; `onAgentEnd` now only renders the dashboard.
- **`close-issue` checklist item** — closing is now handled by the close-confirmation dialog after the last `task_done`.
```
