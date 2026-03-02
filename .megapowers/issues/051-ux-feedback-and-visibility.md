---
id: 51
type: feature
status: open
created: 2026-02-24T19:15:00.000Z
sources: [22, 31, 36, 37, 45]
milestone: M1
priority: 2
---

# UX feedback, visibility & transparency

Batch addressing UX gaps in megapowers:

1. **Progress indicators** — tool calls (`megapowers_signal`, etc.) show no visible progress; TUI appears frozen while agent works. Need loading/status indicators.
2. **Notification clarity** — after phase transitions, show artifact filename so user knows what was saved and where. General notification consistency and polish.
3. **Multi-select & Discuss** — done-phase wrap-up uses single-select-then-loop instead of multi-select. All phase menus lack a "Discuss" escape hatch.
4. **Prompt injection visibility** — injection happens invisibly (`display: false`). Need a compact status indicator showing what was injected, plus optional `/mega context` debug command.

Absorbs #042 (interactive UX transparency).
