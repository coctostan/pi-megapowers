---
id: 42
type: feature
status: open
created: 2026-02-24T00:48:10.229Z
sources: [36, 37]
milestone: M1
priority: 2
---

# Interactive UX transparency — multi-select, Discuss option, prompt injection visibility

Two UX improvements that make megapowers feel less like a black box. (1) The done-phase wrap-up menu (handleDonePhase in ui.ts) uses single-select-then-loop instead of multi-select, and all phase menus lack a "Discuss" escape hatch that lets the user talk to the LLM without triggering a transition. (2) Prompt injection happens completely invisibly (display: false in the before_agent_start hook) — the user has no way to know the context was sent, which phase was briefed, or whether injection occurred at all. Needs a compact status indicator (dashboard widget or status bar) showing what was injected, plus an optional /mega context debug command to display the full injected prompt. Both issues are about making the interactive layer transparent and ergonomic; they share ui.ts and the prompt injection path.
