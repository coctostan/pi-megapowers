## Goal
Build lightweight Megapowers context visibility by adding a compact non-notification TUI status indicator and `/mega context` / `/mp context` inspection commands, while preserving the existing hidden prompt injection path and making phase-specific tool guidance inspectable without storing derived context in workflow state.

## Acceptance Criteria
1. `onBeforeAgentStart` continues to inject the hidden `megapowers-context` message when `buildInjectedPrompt(cwd, store)` returns prompt content.

2. When context injection occurs and `ctx.hasUI` is true, `onBeforeAgentStart` updates a compact TUI status indicator using `ctx.ui.setStatus(...)` rather than `ctx.ui.notify(...)`.

3. The compact TUI status text includes at least workflow, phase, and one additional context signal such as plan mode, task progress, or artifact count.

4. The compact TUI status text includes plan mode when the current state is in the `plan` phase with a plan mode.

5. The compact TUI status text includes current task progress when derived tasks exist and the current phase is task-oriented.

6. The compact TUI status text includes artifact availability using an artifact count or equivalent artifact-presence signal.

7. `/mega context` renders an on-demand context inspection report.

8. `/mp context` renders the same context inspection report as `/mega context`.

9. The default context inspection report includes current workflow and phase.

10. The default context inspection report includes plan mode when applicable.

11. The default context inspection report includes current task and TDD state when applicable.

12. The default context inspection report includes included artifacts or artifact availability.

13. The default context inspection report does not include the full rendered prompt text.

14. `/mega context debug` renders debug details that include the rendered prompt or an explicit rendered-prompt section.

15. `/mp context debug` renders the same debug details as `/mega context debug`.

16. Context summary and inspection data are derived on demand from disk-backed state, derived tasks, workflow config, and artifact files.

17. Running context summary, `/mega context`, `/mp context`, `/mega context debug`, or `/mp context debug` does not write derived prompt/context data into `.megapowers/state.json`.

18. The implementation provides a clear context/tool-guidance summary that identifies which phase or mode guidance is active.

19. The context/tool-guidance summary references existing phase-specific guidance instead of duplicating large tool descriptions into a new parallel guidance system.

20. The context/tool-guidance summary handles project-specific tools as “preferred if available” or equivalent wording unless active-tool detection is implemented.

21. Existing phase-specific prompt guidance behavior remains intact for current prompt files and `docs/phase-tools.md`.

22. The hidden injected prompt does not materially grow with large duplicated tool descriptions as part of this feature.

23. Context visibility behavior is testable through unit tests or mocked hook/command contexts without requiring a live Pi TUI.

## Out of Scope
- Exposing every hidden system message by default is out of scope.
- Persisting full rendered prompt text or derived context into `.megapowers/state.json` is out of scope.
- Broad prompt-template redesign is out of scope.
- General dashboard, widget, or footer redesign is out of scope.
- A full cross-repository dynamic tool-capability system is out of scope.
- Notification-based context readiness indicators are explicitly out of scope.
- A persistent widget via `ctx.ui.setWidget(...)` is optional and not required unless footer status proves insufficient during implementation.
- Active-tool detection for absent project-specific tools is optional; simple “preferred if available” handling is sufficient.

## Open Questions
None.

## Requirement Traceability
- R1 -> AC 1, AC 2
- R2 -> AC 2
- R3 -> AC 2
- R4 -> AC 3
- R5 -> AC 3, AC 9
- R6 -> AC 4, AC 10
- R7 -> AC 5, AC 11
- R8 -> AC 6, AC 12
- R9 -> AC 7, AC 8
- R10 -> AC 7
- R11 -> AC 8
- R12 -> AC 9
- R13 -> AC 10
- R14 -> AC 11
- R15 -> AC 12
- R16 -> AC 13
- R17 -> AC 14, AC 15
- R18 -> AC 14, AC 15
- R19 -> AC 16
- R20 -> AC 17
- R21 -> AC 18, AC 19
- R22 -> AC 18
- R23 -> AC 19, AC 22
- R24 -> AC 20
- R25 -> AC 22
- R26 -> AC 21

- O1 -> AC 3
- O2 -> Out of Scope
- O3 -> AC 18
- O4 -> Out of Scope
- D1 -> Out of Scope
- D2 -> Out of Scope
- D3 -> Out of Scope
- D4 -> Out of Scope
- D5 -> Out of Scope
- D6 -> Out of Scope
- C1 -> AC 17
- C2 -> AC 16
- C3 -> AC 1
- C4 -> AC 1, AC 7, AC 8
- C5 -> AC 19, AC 22
- C6 -> AC 21
- C7 -> AC 23
- C8 -> AC 19, Out of Scope
- C9 -> AC 2
- C10 -> AC 20
