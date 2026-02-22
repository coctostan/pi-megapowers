---
id: 7
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# User has no guidance after picking a phase

After selecting a phase transition (e.g. brainstorm → spec), the extension updates the phase but the user sees no indication of what to do next. The prompt template is injected on the *next* agent turn, but in the meantime the user is staring at a blank input with no context. 

Need either: immediate feedback after transition ("You're now in spec phase — describe what this feature should do"), or auto-trigger the first agent turn with the phase prompt.
