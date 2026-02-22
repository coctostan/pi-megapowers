---
id: 5
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# Brainstorm phase asks to move to spec on every step

During the brainstorm phase, the extension prompts the user to transition to the spec phase after every single brainstorm output. This makes brainstorming feel rushed and interrupts the flow. The phase transition offer should only appear when the user explicitly signals they're done brainstorming (e.g. via `/phase next`), or at minimum should not repeat after being declined.
