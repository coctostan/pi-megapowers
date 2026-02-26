# Spec: Kill Phase Transition Popup (#072)

## Goal

Remove the two blocking popup dialogs (`handlePhaseTransition` and `handleDonePhase`) that interrupt the agent after every turn, and replace them with agent-driven mechanisms: a new `phase_back` signal action for backward transitions, and a non-blocking done-phase checklist widget. Phase transitions become fully agent-controlled via `megapowers_signal` tool calls, with prompts updated to instruct the agent when to advance forward or go back.

## Acceptance Criteria

1. `megapowers_signal({ action: "phase_back" })` resolves the first `backward: true` transition from the current phase and advances to that target
2. `phase_back` from `review` transitions to `plan` and clears `reviewApproved` to `false`
3. `phase_back` from `verify` transitions to `implement`
4. `phase_back` from `code-review` transitions to `implement`
5. `phase_back` returns an error when no backward transition exists for the current phase (e.g., from `brainstorm`, `spec`, `plan`, `implement`)
6. `phase_back` returns an error when called from any bugfix workflow phase (no backward transitions defined in bugfix config)
7. `phase_next` default target resolution (when no explicit target is provided) skips transitions marked `backward: true` — it picks the first non-backward transition
8. Existing `phase_next` behavior is preserved: gates are still evaluated, jj operations still fire, forward transitions still work for all phases
9. `onAgentEnd` no longer calls `handlePhaseTransition` — no blocking `ctx.ui.select()` popup after agent turns
10. `onAgentEnd` no longer calls `handleDonePhase` — no blocking done-phase menu after agent turns
11. When the workflow enters the `done` phase, a checklist widget is shown via `ctx.ui.custom()` with wrap-up actions (generate docs/summary, write changelog, capture learnings, squash task changes, close issue)
12. All done-checklist items default to checked
13. Submitting the done checklist stores the selected action keys as `doneActions: string[]` in state
14. Dismissing the done checklist (e.g., Escape) stores an empty `doneActions: []` in state
15. The `doneMode` field on `MegapowersState` is replaced with `doneActions: string[]` (default `[]`)
16. The done-phase prompt template reads `doneActions` from state and instructs the agent to execute each selected action sequentially
17. All done actions are agent-driven — the agent performs docs generation, changelog writing, learnings capture, squash (via bash), and issue close (via tool) based on the `doneActions` list
18. `megapowers-protocol.md` documents `phase_back` alongside the existing signal actions
19. `verify.md` instructs the agent to call `megapowers_signal({ action: "phase_back" })` instead of referencing `/phase implement` for going back
20. `code-review.md` instructs the agent to call `phase_back` instead of referencing `/phase implement` or `/phase plan`
21. `review-plan.md` instructs the agent to call `phase_back` when the plan needs rework, instead of relying on user-driven phase change
22. `handlePhaseTransition` is removed from `ui.ts` and the `MegapowersUI` interface
23. `handleDonePhase` is removed from `ui.ts` and the `MegapowersUI` interface
24. `DONE_MODE_LABELS` constant is removed from `ui.ts`
25. No remaining references to `doneMode` in the codebase (replaced by `doneActions`)

## Out of Scope

- Adding backward transitions to the bugfix workflow — only feature workflow has them
- Auto-advance (system automatically transitions without agent action) — transitions remain agent-driven via tool calls
- Changes to the `/phase` slash command — it continues to work as-is for manual override
- Notification bar or persistent phase indicator — dashboard widget already exists
- Changes to `handleIssueCommand` or `handleTriageCommand` — those select dialogs are unrelated
- Gate evaluation logic changes — gates still work the same, backward transitions still skip gates

## Open Questions

*None.*