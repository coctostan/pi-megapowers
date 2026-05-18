## Goal
Make Megapowers prompt/context injection visible, inspectable, and less opaque by adding a compact non-notification context indicator and an on-demand context inspection surface, while preserving phase-specific tool guidance without increasing prompt bloat or persisting derived prompt/context into workflow state.

## Mode
Direct requirements

The source issues already describe concrete desired behavior: users need visibility into hidden Megapowers context injection, and phase/mode-specific tool guidance must remain compact, debuggable, and non-conflicting. The discussion clarified UX constraints and debug command shape rather than changing the core scope.

## Must-Have Requirements
R1. Users can tell when Megapowers context injection occurred before an agent turn.

R2. The compact context indicator must not use notifications.

R3. The compact context indicator uses a TUI surface such as footer status, with `ctx.ui.setStatus(...)` as the preferred baseline.

R4. The compact context indicator includes more than the phase name.

R5. The compact context indicator includes the current workflow and phase when an active workflow exists.

R6. The compact context indicator includes plan mode when the current phase is `plan`.

R7. The compact context indicator includes current task progress when task data exists.

R8. The compact context indicator includes artifact count or equivalent artifact-presence signal.

R9. Users can inspect current derived Megapowers context on demand through a command.

R10. The inspection command is available through `/mega context`.

R11. The inspection command is available through `/mp context`.

R12. The inspection output shows current workflow and phase.

R13. The inspection output shows plan mode when applicable.

R14. The inspection output shows current task and TDD state when applicable.

R15. The inspection output shows included artifacts or artifact availability.

R16. The default inspection output shows metadata only and does not dump the full rendered prompt.

R17. Rendered prompt/debug details are available only through explicit debug commands.

R18. The explicit debug commands are `/mega context debug` and `/mp context debug`.

R19. Context inspection derives information on demand from state and artifact files.

R20. Derived prompt/context details are not persisted into `.megapowers/state.json`.

R21. Prompt assembly has a clear strategy for combining base instructions with phase-specific tool guidance.

R22. Phase-specific tool guidance remains debuggable and inspectable.

R23. The strategy avoids duplicating large tool descriptions across every injected prompt.

R24. The strategy handles project-specific tools that may be absent in other repositories without producing misleading or broken guidance.

R25. The resulting injected prompt/context should not materially worsen context bloat.

R26. Existing phase-specific prompt guidance from issue #127 should be extended or surfaced, not replaced with an unrelated system.

## Optional / Nice-to-Have
O1. The compact context indicator may use a short format such as `⚡ feature/implement • task 2/5 • 3 artifacts`.

O2. A persistent widget via `ctx.ui.setWidget(...)` may be used if footer status is too cramped for useful context.

O3. The inspect output may include a compact summary of active tool guidance/profile for the current phase or mode.

O4. If Pi exposes active tools cleanly, absent project-specific tools may be detected and reflected in inspect/debug output.

## Explicitly Deferred
D1. Exposing every hidden system message by default is deferred.

D2. Persisting full prompt text or rendered context into coordination state is deferred.

D3. A broad redesign of all prompt templates is deferred.

D4. A general UI overhaul of the dashboard/status widget is deferred unless required for the compact context indicator.

D5. A full cross-repository dynamic tool-capability system is deferred.

D6. Notification-based context readiness indicators are deferred/excluded from this issue.

## Constraints
C1. `.megapowers/state.json` must remain coordination state only and must not store derived prompt/context.

C2. Derived context must be computed from disk-backed state and artifact files on demand.

C3. The existing hidden `megapowers-context` injection path should remain the source of agent instructions unless implementation evidence shows a safer alternative.

C4. The implementation should fit current architecture: `hooks.ts` handles injection, `prompt-inject.ts` builds prompts, `commands.ts` handles `/mega`, and `mp/mp-handlers.ts` handles `/mp`.

C5. Phase-specific tool guidance should stay compact and avoid repeating large generic tool descriptions.

C6. The solution should preserve existing #127 behavior already represented in `prompts/*.md`, `docs/phase-tools.md`, and related tests.

C7. The implementation should be testable without relying on live Pi UI behavior.

C8. The solution should use small, inspectable mechanisms over speculative abstractions.

C9. TUI implementation should prefer `ctx.ui.setStatus(...)` for compact persistent context because Pi documentation describes footer status as suitable for mode indicators.

C10. Project-specific tool guidance should use simple absent-tool handling, such as “preferred if available,” unless active-tool detection is straightforward.

## Open Questions
None.

## Recommended Direction
Implement this as a thin context-summary layer beside existing prompt injection rather than changing the hidden injection mechanism itself. `buildInjectedPrompt` can continue assembling the full hidden prompt, while a new derived summary helper computes lightweight metadata such as workflow, phase, plan mode, task progress, TDD state, artifact availability, and tool-guidance/profile presence.

Use Pi’s TUI status API for the compact indicator instead of notifications. The implementation should set a persistent footer status when context is built, using a concise string that includes workflow/phase plus task, plan mode, or artifact signals when relevant. A widget can remain optional if status text proves too constrained.

Add an inspect command path for both `/mega context` and `/mp context`. The command should derive context from `readState`, `deriveTasks`, artifact files, and the same prompt/tool-guidance metadata used by injection. The default output should show structured metadata and included artifacts; full rendered prompt details should require `/mega context debug` or `/mp context debug`.

Treat issue #127 as partially implemented. Preserve the current prompt-file/tool-guidance mapping and make it inspectable rather than replacing it. If a compact tool-profile abstraction is introduced, it should reference existing phase/mode guidance and handle absent project-specific tools with simple “preferred if available” semantics unless active-tool detection is already easy.

## Testing Implications
- Add unit tests for context-summary derivation across idle, brainstorm/spec, plan draft/review/revise, implement with tasks, and done states.
- Add hook tests verifying `before_agent_start` still injects hidden `megapowers-context` and updates a compact TUI status indicator without notifications.
- Add command tests for `/mega context` showing workflow, phase, plan mode, task/TDD state, and artifact availability.
- Add command tests for `/mega context debug` including rendered prompt/debug details only in debug mode.
- Add `/mp context` and `/mp context debug` dispatch/completion tests.
- Add tests proving default inspect output does not include full rendered prompt text.
- Add tests proving derived context/debug output is not written to `.megapowers/state.json`.
- Add regression tests preserving existing phase-specific tool guidance behavior from #127.
