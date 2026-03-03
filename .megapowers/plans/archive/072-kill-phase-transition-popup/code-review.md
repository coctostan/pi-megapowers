## Files Reviewed

- `extensions/megapowers/tools/tool-signal.ts` — Added `handlePhaseBack`, registered `phase_back` case
- `extensions/megapowers/policy/phase-advance.ts` — AC7: default target resolution skips backward transitions
- `extensions/megapowers/policy/gates.ts` — Backward transitions skip gate evaluation
- `extensions/megapowers/hooks.ts` — Removed `handlePhaseTransition` / `handleDonePhase` calls; done-phase artifact capture updated for `doneActions`
- `extensions/megapowers/ui.ts` — Removed `DONE_MODE_LABELS`, `handlePhaseTransition`, `handleDonePhase`; added `DoneChecklistItem`, `getDoneChecklistItems`, `showDoneChecklist`
- `extensions/megapowers/ui-checklist.ts` — New: reusable `showChecklistUI` TUI widget
- `extensions/megapowers/register-tools.ts` — Wires done-checklist trigger after `phase_next` → done
- `extensions/megapowers/commands.ts` — `handleDoneCommand` now calls `showDoneChecklist` directly
- `extensions/megapowers/state/state-machine.ts` — `doneMode` → `doneActions: string[]`; `transition()` resets `doneActions = []` and `reviewApproved` on plan entry
- `extensions/megapowers/state/state-io.ts` — `KNOWN_KEYS` updated with `doneActions`
- `extensions/megapowers/prompt-inject.ts` — Done-phase path injects `done.md` template when `doneActions.length > 0`
- `extensions/megapowers/prompts.ts` — Added `done: "done.md"` to `PHASE_PROMPT_MAP`
- `prompts/done.md` — New: agent instructions for all wrap-up actions
- `prompts/megapowers-protocol.md` — Documents `phase_back`
- `prompts/verify.md`, `prompts/code-review.md`, `prompts/review-plan.md` — Updated to use `megapowers_signal({ action: "phase_back" })`
- `prompts/generate-bugfix-summary.md` — Added `{{files_changed}}` section
- Tests: `tool-signal.test.ts`, `phase-advance.test.ts`, `ui.test.ts`, `prompt-inject.test.ts`, `state-io.test.ts`, `state-machine.test.ts`
- New: `tests/hooks.test.ts` — tests for done-phase doneActions cleanup and structural assertion for handlePhaseBack

---

## Strengths

- **`gates.ts:27-29`** — Backward transitions correctly skip gate evaluation via an explicit `if (transition.backward) return { pass: true }` guard. Clean and easy to audit.

- **`state-machine.ts:124-126` and `:137-138`** — `transition()` resets both `reviewApproved` (when entering plan) and `doneActions` (on every transition) as atomic parts of the transition operation. This is the right place for these invariants.

- **`ui-checklist.ts`** — The checklist widget is well-implemented: clean render → input → done callback pattern, correct Space/Enter navigation, Escape returns `null` (distinguished from empty selection). The `cachedLines` invalidation pattern matches the pi TUI model.

- **`showDoneChecklist` guard** (`ui.ts:91-92`) — Two-line guard (`!state.activeIssue || state.phase !== "done"` + `!ctx.hasUI`) prevents silently writing state in non-interactive or wrong-phase contexts.

- **`register-tools.ts:41-47`** — The comment "Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation" is exactly right. Single trigger point, with clear rationale.

- **`phase-advance.ts:32-37`** — AC7 default-target selection is readable: explicit `forwardTransition` lookup before falling back to `validNext[0]`, with a clear comment.

- **Test coverage** — `phase_back` tests are comprehensive: all three backward transitions, all no-backward-transition error paths, bugfix workflow rejection, and `megaEnabled: false` guard. The AC7 tests cleverly reorder `featureWorkflow.transitions` in place to stress-test the skip logic.

---

## Findings

### Critical

None.

### Important (both fixed in this session)

**1. `handlePhaseBack` contained a redundant intermediate state write** (`tool-signal.ts:278-281`) — FIXED

The block:
```typescript
if (backwardTransition.to === "plan") {
  const currentState = readState(cwd);   // ← unnecessary second read
  writeState(cwd, { ...currentState, reviewApproved: false });  // ← redundant
}
```
was removed. `transition()` in `state-machine.ts:124-126` already resets `reviewApproved = false` whenever `to === "plan"`. The explicit write was redundant AND introduced a stale-state risk: if `advancePhase` had failed after the intermediate write, state would have been left with `reviewApproved: false` but still in the `review` phase — an inconsistent combination. A comment was added in its place to clarify the invariant ownership.

**2. `capture-learnings` was never removed from `doneActions`** (`hooks.ts:133`) — FIXED

The old code:
```typescript
if (doneAction !== "capture-learnings") {
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
}
```
Special-cased `capture-learnings` so it was never removed from the list. After the agent used `megapowers_save_artifact` to save learnings, `capture-learnings` persisted in `doneActions` indefinitely within the terminal `done` phase. On subsequent turns the done.md template kept listing it as a pending action. Fix: removed the special case — all actions are now removed symmetrically after the agent produces text > 100 chars.

### Minor

**3. Inconsistent action-removal heuristic for `squash-task-changes` and `close-issue`** (`hooks.ts:124`)

For `squash-task-changes` and `close-issue`, removal from `doneActions` depends on the agent producing text > 100 chars — a heuristic unrelated to whether the action was actually completed. A short confirmation ("Squashed.") would leave these in the list. Not worth fixing now since state resets with a new issue, but worth noting for a future cleanup.

**4. Double blank line in `ui.ts`** (around line 105-106)

Two blank lines between `showDoneChecklist` and `renderStatusText`. Cosmetic only.

---

## Recommendations

1. **Make `doneActions` cleanup fully explicit**: Each action that can be added to `doneActions` ideally has a clear removal path tied to completion (not a text-length heuristic). For `squash-task-changes` and `close-issue`, consider having the agent call a `megapowers_signal` action or having `handleSaveArtifact` remove specific keys. This is a longer-term improvement.

2. **Add a `handleDoneCommand` test**: The `handleDoneCommand` in `commands.ts` now calls `showDoneChecklist` instead of `ui.handleDonePhase`. This wiring change is tested indirectly, but a direct unit test (wrong phase guard, state read, renderDashboard call) would be a small and useful addition.

---

## Assessment

**ready**

All acceptance criteria verified. Two important findings (redundant intermediate state write in `handlePhaseBack`, `capture-learnings` never removed from `doneActions`) were fixed in this session with new tests confirming the regressions and the fixes. Full test suite: 665 pass, 0 fail.
