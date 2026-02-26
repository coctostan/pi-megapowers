Here's the feature document for your review:

---

# Feature: Kill Phase Transition Popup (#072)

## Summary

Removed the two blocking popup dialogs (`handlePhaseTransition` and `handleDonePhase`) that interrupted the agent after every turn, replacing them with fully agent-driven phase control. A new `phase_back` signal action handles backward transitions, and a non-blocking TUI checklist widget (via `ctx.ui.custom()`) presents wrap-up options when entering the `done` phase. Phase flow is now controlled entirely by the agent via `megapowers_signal` tool calls, with prompts updated to instruct when to advance or retreat.

## Design Decisions

**Agent-driven transitions over auto-prompting.** Rather than the system interrupting after every agent turn to offer a "go to next phase?" dialog, transitions are now entirely explicit tool calls. This removes a source of unexpected blocking behavior and makes the agent's control flow legible from the conversation itself.

**`phase_back` as a first-class signal action.** Backward transitions were previously only possible via the `/phase` slash command (manual user override). Making them an agent-callable signal lets prompts instruct the agent to retreat when verification fails or code review finds rework — no user intervention needed.

**`phase_next` default skips backward transitions.** The workflow transition config already supported a `backward: true` flag on transitions, but the default target picker (`validNext[0]`) could accidentally resolve to a backward target if it appeared first in the array. The fix — find the first non-backward transition — is minimal and preserves all gate logic.

**`doneMode` → `doneActions: string[]`.** The old `doneMode` was a single-select enum (one wrap-up action at a time). Replacing it with an array lets the agent execute all selected wrap-up actions sequentially from a single `done.md` prompt, rather than looping through a UI menu repeatedly.

**Done checklist triggered on `phase_next` → done, not in `onAgentEnd`.** Placing the trigger in `register-tools.ts` (immediately after a successful `phase_next`) ensures it fires exactly once and only for the `phase_next` action — not on every agent turn.

**`done.md` single template replaces per-action templates.** Instead of dispatching to `generate-docs.md`, `write-changelog.md`, etc. based on `doneActions[0]`, a unified `done.md` template receives the full `{{done_actions_list}}` and contains instructions for all action types. The agent executes them sequentially in one pass.

## API / Interface

### New signal action: `phase_back`
```ts
megapowers_signal({ action: "phase_back" })
```
Resolves the first `backward: true` transition from the current phase and advances to that target. Backward transitions defined in the feature workflow:
- `review` → `plan` (also clears `reviewApproved: false`)
- `verify` → `implement`
- `code-review` → `implement`

Returns an error if called from a phase with no backward transition, or from any bugfix workflow phase.

### Updated tool description
`megapowers_signal` action enum now includes `"phase_back"` and the tool description documents the backward-transition semantics.

### State schema change
`MegapowersState.doneMode` removed; replaced with `doneActions: string[]` (default `[]`). Persisted via `state.json`.

### New exports from `ui.ts`
- `getDoneChecklistItems(state: MegapowersState): DoneChecklistItem[]` — pure function returning checklist items for the done phase, all defaulting to checked
- `showDoneChecklist(ctx, cwd): Promise<void>` — shows the TUI checklist and writes `doneActions` to state

### New file: `extensions/megapowers/ui-checklist.ts`
Reusable `showChecklistUI()` TUI widget using `ctx.ui.custom()`. Supports ↑↓ navigation, Space/Enter toggle, Enter-on-Submit to confirm, Escape to dismiss.

### New prompt template: `prompts/done.md`
Single template for the done phase. Receives `{{done_actions_list}}` (the selected actions as a bullet list) and provides per-action instructions for docs generation, changelog writing, learnings capture (via `megapowers_save_artifact`), squashing task changes (via bash), and issue close.

### Updated prompt files
- `prompts/megapowers-protocol.md` — documents `phase_back`
- `prompts/verify.md` — instructs `phase_back` instead of `/phase implement`
- `prompts/code-review.md` — instructs `phase_back` for needs-rework; removes `/phase` references
- `prompts/review-plan.md` — instructs `phase_back` when plan needs rework

### Removed from `MegapowersUI` interface and `ui.ts`
- `handlePhaseTransition` — blocking post-turn transition popup
- `handleDonePhase` — blocking done-phase action menu
- `DONE_MODE_LABELS` constant

## Testing

All 659 tests pass across 32 test files.

**New tests added:**
- `tests/tool-signal.test.ts` — 10 new `phase_back` cases (happy paths for review→plan, verify→implement, code-review→implement; error paths for all non-backward phases; bugfix workflow rejection; disabled-mega guard)
- `tests/phase-advance.test.ts` — 7 new cases verifying default target skips backward transitions for verify, code-review, and review; explicit backward override still works; existing gate behavior preserved
- `tests/ui.test.ts` — `getDoneChecklistItems` (5 cases: feature/bugfix workflows, squash conditional, key/label presence) and `showDoneChecklist` (5 cases: submit stores selected keys, escape stores empty array, partial selection, phase guard, no-active-issue guard)
- `tests/prompt-inject.test.ts` — 6 new done-phase injection cases covering doneActions list, single action, empty doneActions (no injection), learnings instruction, close-issue instruction
- `tests/state-machine.test.ts` — `doneActions` field init and reset-on-transition
- `tests/hooks.test.ts` — new test file added (wiring verification)

**Testing approach:** Pure unit tests throughout — no TUI rendering tested (the `showChecklistUI` widget depends on live terminal primitives; correctness verified by TypeScript compilation + integration). The `showDoneChecklist` tests mock `ctx.ui.custom` to return predetermined values, isolating the state-write logic from the TUI.

## Files Changed

**Source — modified:**
- `extensions/megapowers/state/state-machine.ts` — `doneMode` → `doneActions: string[]` in type, initial state, and `transition()` reset
- `extensions/megapowers/state/state-io.ts` — `KNOWN_KEYS` updated: `"doneMode"` → `"doneActions"`
- `extensions/megapowers/tools/tool-signal.ts` — added `phase_back` case and `handlePhaseBack()` implementation
- `extensions/megapowers/policy/phase-advance.ts` — default target resolution skips `backward: true` transitions
- `extensions/megapowers/hooks.ts` — removed `handlePhaseTransition`/`handleDonePhase` calls from `onAgentEnd`; updated done-phase artifact capture to use `doneActions`
- `extensions/megapowers/prompt-inject.ts` — done-phase block uses `doneActions` + unified `done.md` template with `done_actions_list` variable
- `extensions/megapowers/prompts.ts` — `PHASE_PROMPT_MAP` done entry updated to `"done.md"`
- `extensions/megapowers/register-tools.ts` — `phase_back` added to action schema; done checklist trigger wired after `phase_next` → done
- `extensions/megapowers/ui.ts` — `doneMode` refs replaced; `handlePhaseTransition`, `handleDonePhase`, `DONE_MODE_LABELS` removed; `getDoneChecklistItems` and `showDoneChecklist` added
- `extensions/megapowers/commands.ts` — `handleDoneCommand` updated to call `showDoneChecklist`
- `prompts/megapowers-protocol.md` — `phase_back` documented
- `prompts/verify.md` — `phase_back` instruction added
- `prompts/code-review.md` — `phase_back` replaces `/phase implement`/`/phase plan` references
- `prompts/review-plan.md` — `phase_back` instruction for plan rework
- `prompts/generate-bugfix-summary.md` — minor update

**Source — added:**
- `extensions/megapowers/ui-checklist.ts` — reusable TUI checklist widget (`showChecklistUI`)
- `prompts/done.md` — unified done-phase prompt template

**Tests — modified:**
- `tests/state-machine.test.ts`, `tests/state-io.test.ts`, `tests/tool-signal.test.ts`, `tests/phase-advance.test.ts`, `tests/prompt-inject.test.ts`, `tests/ui.test.ts`

**Tests — added:**
- `tests/hooks.test.ts`

**Artifacts (megapowers internal):**
- `.megapowers/plans/072-kill-phase-transition-popup/code-review.md`
- `.megapowers/plans/072-kill-phase-transition-popup/verify.md`
- `.megapowers/plan-review.md`

---

Does this look good? I'll save it once you approve.