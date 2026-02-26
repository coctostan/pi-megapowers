# Brainstorm: Kill Phase Transition Popup (#072)

## Approach

Remove the blocking `ctx.ui.select()` popup that appears after every agent turn in `onAgentEnd`. Phase transitions become fully agent-driven: the agent calls `megapowers_signal({ action: "phase_next" })` to advance forward and `megapowers_signal({ action: "phase_back" })` to go backward. Both use the same mechanism — resolving a target from the workflow config and calling `advancePhase()`. Non-blocking `ctx.ui.notify()` confirms transitions. The phase prompts already instruct the agent when to advance; they'll be updated to also instruct when to go back.

The done-phase blocking menu (`handleDonePhase`) is replaced with a checklist widget using `ctx.ui.custom()` (similar to the questionnaire extension pattern). When the workflow enters done, a checklist appears with wrap-up actions (generate docs/summary, write changelog, capture learnings, squash task changes, close issue) — all checked by default. The user deselects anything they don't want, hits submit, and the selected actions are stored in state as `doneActions: string[]`. The done-phase prompt reads this list and instructs the agent to execute each action sequentially. All actions are agent-driven for consistency.

Phase prompts across both feature and bugfix workflows are updated to reference `phase_back` where backward transitions exist (verify, code-review, review in feature workflow). The central `megapowers-protocol.md` adds `phase_back` to the tool reference. Bugfix workflow has no backward transitions defined, so `phase_back` correctly errors if called during a bugfix.

## Key Decisions

- **Agent-driven transitions, not system-driven auto-advance** — The agent decides when to advance via tool calls. Simpler, less magic, consistent with existing `phase_next` pattern.
- **`phase_back` via same `megapowers_signal` mechanism** — Not a different mechanism. Both forward and back resolve a target from workflow config and call `advancePhase()`. Forward picks first non-backward transition; back picks first `backward: true` transition.
- **Kill both popups** — The `handlePhaseTransition` popup (after every agent turn) and the `handleDonePhase` menu (done-phase action picker) are both removed.
- **Done checklist via `ctx.ui.custom()`** — Inline checklist widget shown once on entering done. All actions default-checked. User deselects what they don't want. Selections stored as `doneActions[]` in state.
- **All done actions are agent-driven** — No split between "system-automated" and "agent-driven". The agent handles everything (docs, changelog, learnings, squash via bash, close via tool) for uniformity.
- **Prompt updates are in scope** — Prompts are the agent's instructions. If they reference the old popup model, the agent won't know how to use the new mechanism.

## Components

1. **`tool-signal.ts`** — Add `phase_back` action handler. Resolves backward target from workflow config, calls `advancePhase(cwd, backwardTarget, jj)`. Error if no backward transition exists.

2. **`hooks.ts` (`onAgentEnd`)** — Remove `handlePhaseTransition` call. Replace with non-blocking `ctx.ui.notify()` for phase confirmation.

3. **`ui.ts`** — Remove `handlePhaseTransition` and `handleDonePhase`. Add done-phase checklist widget using `ctx.ui.custom()`.

4. **State (`state.json`)** — Replace `doneMode: string | null` with `doneActions: string[]`. Store user's checklist selections.

5. **Prompt updates:**
   - `megapowers-protocol.md` — Add `phase_back` to tool reference
   - `verify.md` — Replace "user will need to use `/phase implement`" with `megapowers_signal({ action: "phase_back" })`
   - `code-review.md` — Same: instruct agent to call `phase_back`
   - `review-plan.md` — Add `phase_back` instruction for plan rework
   - Done-phase prompts (`generate-docs.md`, `generate-bugfix-summary.md`, `write-changelog.md`, `capture-learnings.md`) — Adapt to `doneActions` list model

6. **Dead code cleanup** — Remove `handlePhaseTransition`, `handleDonePhase`, `DONE_MODE_LABELS`, and related `doneMode` references.

## Testing Strategy

- **`phase_back` signal:** Unit tests in `tool-signal.test.ts`. Test backward transitions (review→plan, verify→implement, code-review→implement). Test error when no backward transition exists (e.g., from brainstorm, or any bugfix phase). Test state resets (reviewApproved cleared on back to plan).
- **`phase_next` unchanged:** Existing tests continue to pass. Verify forward resolution skips `backward: true` transitions.
- **Popup removal:** Test that `onAgentEnd` no longer calls blocking UI. Verify hook completes without `ctx.ui.select()`.
- **Done checklist logic:** Extract action-selection logic (available actions, defaults, state storage) into pure functions. Test checklist → state mapping. Test cancelled checklist (Esc → no actions stored).
- **Done prompt integration:** Test that done-phase prompt template correctly interpolates `doneActions` list from state.
- **Prompt content:** Verify updated prompts reference `phase_back` where backward transitions exist and `phase_next` everywhere else.
- **Dead code:** Verify `handlePhaseTransition` and `handleDonePhase` are removed and no references remain.
