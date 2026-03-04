---
id: 84
type: bugfix
status: done
created: 2026-03-03T13:53:46.723Z
sources: [81, 83]
---
# Done-phase close-issue bug and code-review checklist timing

Two bugfixes around workflow phase transitions:

1. **#081** — close-issue wrap-up action not executed in prompt-driven done phase (headless/no-TUI: `doneActions` never populated → `onAgentEnd` skips close logic)
2. **#083** — Code-review done-phase checklist fires synchronously inside `phase_next` tool call (UX timing: user commits to wrap-up actions before reading the review)

Both are M3 priority-1 issues that directly impact day-to-day workflow reliability.
