## [2026-02-26] — Remove blocking phase-transition popups; add `phase_back` signal

- **New:** `megapowers_signal({ action: "phase_back" })` lets the agent go back to the previous phase (review→plan, verify→implement, code-review→implement) without any user prompt
- **Removed:** Blocking popup dialogs after every agent turn are gone — phase transitions are now fully agent-driven via `megapowers_signal` tool calls
- **New:** Entering the `done` phase shows a non-blocking checklist widget for wrap-up actions (generate docs, write changelog, capture learnings, squash, close issue); the agent then executes selected actions autonomously
- **Changed:** `doneMode` state field replaced with `doneActions: string[]`; prompt templates updated to reflect the new agent-driven flow
