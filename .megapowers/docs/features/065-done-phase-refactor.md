# Done Phase Refactor

## Summary

Refactored the done phase from a fragile `onAgentEnd` message-scraping mechanism into a tool-driven sequential action runner. The LLM now executes wrap-up actions (docs, changelog, learnings, VCS, project docs) using existing tools, calling `task_done` after each to track progress. A close-confirmation dialog triggers after all actions complete.

## Motivation

The previous done phase relied on `onAgentEnd` to scrape assistant messages and infer what wrap-up actions had been completed. This was brittle — it depended on regex matching LLM output and couldn't handle edge cases like compound responses or unexpected formatting. The refactor makes the done phase explicit and tool-driven, matching the pattern used throughout the rest of the workflow.

## What Changed

### New: `completedDoneActions` state field
- Added `completedDoneActions: string[]` to `MegapowersState`, initialized as `[]`
- Reset to `[]` on every phase transition via `transition()`
- Persisted via `KNOWN_KEYS` in `state-io.ts`
- Tracks which done-phase actions have been marked complete

### New: `handleTaskDone` supports done phase
- `task_done` signal now works in both `implement` and `done` phases
- In done phase: pops the first action from `doneActions`, appends it to `completedDoneActions`
- Returns `closeConfirmation: true` when the last action is completed
- Returns an error when `doneActions` is empty

### New: `handleSaveArtifact` accepts `"learnings"` phase
- Routes to `store.appendLearnings()` with content parsed as a markdown bullet list
- Errors if no parseable bullet items (`- item` or `* item` format)
- Requires a `Store` instance (optional 4th parameter)

### New: Close-confirmation dialog
- `getCloseConfirmationInfo()` returns issue name and source issues for batch issues
- `handleCloseConfirmation()` closes source issues first, then the main issue, then resets state
- Dismissing the dialog keeps the user in done phase without changes
- Wired in `register-tools.ts` via `ctx.ui.select`

### Refactored: `getDoneChecklistItems`
- Added `locked: boolean` to `DoneChecklistItem` interface
- Required actions (`generate-docs`/`generate-bugfix-summary`, `write-changelog`, `capture-learnings`, `update-project-docs`) have `locked: true`
- New `update-project-docs` action (reviews ROADMAP.md, AGENTS.md, README.md)
- Replaced `squash-task-changes` with `vcs-wrap-up` (squash + bookmark + push + PR)
- Removed `close-issue` from checklist (handled by close-confirmation dialog)

### Refactored: Checklist UI
- `ChecklistItem` gained optional `locked?: boolean` field
- Space/Enter on a locked item is a no-op (prevents unchecking required actions)

### Refactored: Done-phase prompt
- Shows completed actions with `✅` prefix and pending actions plainly
- Includes VCS permission instructions (`jj`, `git`, `gh` via `bash`) only when `vcs-wrap-up` is active
- Updated `prompts/done.md` with per-action instructions

### Refactored: Status bar and dashboard
- Status bar shows `"N/M actions complete"` format
- Dashboard shows progress fraction and next action name

### Deleted: `onAgentEnd` artifact-capture block
- Removed message-scraping logic that checked `phase === "done"` and parsed assistant messages
- Removed unused helper functions (`isAssistantMessage`, `getAssistantText`)
- Dashboard rendering preserved

## Files Changed

### Production code
| File | Change |
|------|--------|
| `extensions/megapowers/state/state-machine.ts` | Added `completedDoneActions` to interface, `createInitialState()`, and `transition()` reset |
| `extensions/megapowers/state/state-io.ts` | Added `completedDoneActions` to `KNOWN_KEYS` |
| `extensions/megapowers/tools/tool-signal.ts` | Added `handleDoneTaskDone`, `getCloseConfirmationInfo`, `handleCloseConfirmation`; `closeConfirmation` on `SignalResult` |
| `extensions/megapowers/tools/tool-artifact.ts` | Added `"learnings"` phase handling with bullet parsing; optional `Store` param |
| `extensions/megapowers/register-tools.ts` | Wired store into `handleSaveArtifact`; wired close-confirmation dialog |
| `extensions/megapowers/ui.ts` | Refactored `getDoneChecklistItems` (locked, update-project-docs, vcs-wrap-up); updated status bar and dashboard |
| `extensions/megapowers/ui-checklist.ts` | Added `locked` to `ChecklistItem`; guard toggle on locked items |
| `extensions/megapowers/hooks.ts` | Deleted artifact-capture block; simplified `onAgentEnd` |
| `extensions/megapowers/prompt-inject.ts` | Done prompt shows ✅ completed / pending actions; conditional VCS permission |
| `prompts/done.md` | Rewritten with per-action instructions, VCS permission slot, learnings section |

### Test files
| File | Change |
|------|--------|
| `tests/state-machine.test.ts` | Added `completedDoneActions` reset test |
| `tests/tool-signal.test.ts` | Added done-phase `task_done`, `closeConfirmation`, `getCloseConfirmationInfo`, `handleCloseConfirmation` tests |
| `tests/tool-artifact.test.ts` | Added `"learnings"` phase tests |
| `tests/ui.test.ts` | Replaced done-phase checklist and dashboard tests |
| `tests/ui-checklist.test.ts` | New file: locked item toggle prevention tests |
| `tests/hooks.test.ts` | Replaced artifact-capture tests with removal verification tests |
| `tests/prompt-inject.test.ts` | Added done-phase prompt and VCS permission tests |

## Test Coverage

705 tests pass across 36 files. All 24 acceptance criteria verified with dedicated tests.
