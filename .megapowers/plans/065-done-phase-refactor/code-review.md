## Files Reviewed

- `extensions/megapowers/tools/tool-artifact.ts` — Added `"learnings"` phase routing to `store.appendLearnings()`, new `parseBulletItems()` helper
- `extensions/megapowers/tools/tool-signal.ts` — Added `handleDoneTaskDone()`, `getCloseConfirmationInfo()`, `handleCloseConfirmation()`; refactored `handleTaskDone()` to branch on `done` vs `implement`; extended `SignalResult` with `closeConfirmation?: boolean`
- `extensions/megapowers/register-tools.ts` — Wired `store` into `handleSaveArtifact`, added post-`task_done` close-confirmation dialog interception
- `extensions/megapowers/state/state-machine.ts` — Added `completedDoneActions: string[]` to `MegapowersState`, initialized in `createInitialState()`, reset in `transition()`
- `extensions/megapowers/ui.ts` — Added `locked: boolean` to `DoneChecklistItem`; added `update-project-docs`; replaced `squash-task-changes`/`close-issue` with `vcs-wrap-up`; updated `renderStatusText` to show `N/M actions complete`; updated `renderDashboardLines` done-phase display
- `extensions/megapowers/ui-checklist.ts` — Added `locked?: boolean` to `ChecklistItem`; locked items are no-ops for Space/Enter
- `extensions/megapowers/prompt-inject.ts` — Updated done-phase condition to also fire when `completedDoneActions` is non-empty; ✅ prefix on completed actions; conditional `vcs_permission` injection
- `extensions/megapowers/hooks.ts` — Deleted the `onAgentEnd` artifact-scraping block and all helper types (`isAssistantMessage`, `getAssistantText`, unused imports)
- `prompts/done.md` — Replaced `squash-task-changes`/`close-issue` sections with `vcs-wrap-up`/`update-project-docs`; added `{{vcs_permission}}` slot; added `task_done` callout to each action's instructions
- `tests/tool-artifact.test.ts` — Tests for learnings routing, bullet parsing, no-store error (AC1, AC2)
- `tests/tool-signal.test.ts` — Tests for done-phase `task_done`, close-confirmation signal, `getCloseConfirmationInfo`, `handleCloseConfirmation` (AC3, AC4, AC6, AC19–22)
- `tests/prompt-inject.test.ts` — Tests for ✅/pending rendering, VCS permission conditional (AC7–9)
- `tests/state-machine.test.ts` — Test for `completedDoneActions` reset on transition (AC5)
- `tests/ui.test.ts` — Tests for `getDoneChecklistItems` refactor, `renderStatusText` N/M format (AC10–14, AC16, AC23)
- `tests/ui-checklist.test.ts` (new) — Full keyboard-simulation tests for locked-item toggle prevention (AC15)
- `tests/hooks.test.ts` — Tests confirming artifact-capture block deleted, dashboard render preserved (AC17–18)

---

## Strengths

**Clean disk-first architecture preserved.** `handleCloseConfirmation` (`tool-signal.ts:29–41`) and `handleDoneTaskDone` (`tool-signal.ts:222–239`) both call `readState(cwd)` for fresh data and write through `writeState()`/`createInitialState()`. No in-memory state leaks.

**`parseBulletItems` is robust.** The double-filter (`tool-artifact.ts:68–74`) correctly handles: empty items after stripping the bullet prefix, leading whitespace, both `-` and `*` markers, and trailing whitespace. The function is clean and minimal.

**Complete surgical removal of `onAgentEnd` scraping.** The deleted block (hooks.ts) also correctly removed its now-unused helper functions `isAssistantMessage`, `getAssistantText`, and their imports — no dead code left behind.

**Action queue pattern.** `doneActions[0]` / `slice(1)` is simple and correct. Completed actions being accumulated in `completedDoneActions` with spread (`[...state.completedDoneActions, currentAction]`) is immutable and testable.

**`vcs_permission` injection timing is correct.** Since `vcs-wrap-up` stays in `doneActions` until the LLM calls `task_done` on it, VCS permission is granted during the preceding actions too (e.g., during `write-changelog` if `vcs-wrap-up` is still pending). This means `jj diff` is available for content inspection during earlier actions.

**Test quality.** `tests/ui-checklist.test.ts` tests the actual keypress simulation pathway through the widget, not just mock return values. AC15's three tests (Space on locked, Enter on locked, Space on unlocked) correctly cover all toggle branches. All AC tests are labelled and trace directly to behavior.

**`completedDoneActions` reset placement.** Resetting in `transition()` (`state-machine.ts:141`) is the correct single point — ensures the field is always clean when entering any phase, including `done` on re-entry.

---

## Findings

### Critical
None.

### Important
None.

### Minor

**1. `tool-signal.ts:83` — Misleading error message when no active issue**

```ts
if (!state.activeIssue) {
  return { error: "task_done can only be called during the implement or done phase." };
}
```

The error text describes a phase constraint but the actual failure is "no active issue." This was introduced in this PR when the original combined `if (!state.activeIssue || state.phase !== "implement")` was split into separate checks. The phase-constraint message was copy-pasted to both guards. The user would see a confusing error.

Fix: use `"No active issue. Use /issue to select or create one first."` (matching the convention used by `handleSaveArtifact` and other handlers).

---

**2. `register-tools.ts:53` — `closeStore` duplicates the cached `store` from `ensureDeps`**

```ts
if (result.closeConfirmation && ctx.hasUI) {
  const closeStore = createStore(ctx.cwd);   // ← creates a second store
  const info = getCloseConfirmationInfo(ctx.cwd, closeStore);
  // ...
  handleCloseConfirmation(ctx.cwd, closeStore, ...);
}
```

`store` (from `ensureDeps` on line 38) is already in scope and is functionally identical — `Store` is entirely disk-backed with no in-memory cache. `commands.ts:17–18` documents that `ensureDeps` is the "ONLY place allowed to create store/jj/ui." The `closeStore` sidesteps this by calling `createStore` directly.

No functional bug (both read/write from disk), but it violates the stated convention and creates a transient second object on every close-confirmation.

Fix: replace `closeStore` with `store` throughout the `closeConfirmation` block.

---

**3. `done.md` (generate-docs section) — Removed VCS inspection guidance without a fallback**

Old text:
> Use the spec, plan, verify artifacts and inspect actual changed files via `jj diff` or `git diff` to get the real file list.

New text:
> Inspect actual changed files to get the real file list.

"Inspect actual changed files" is vague and removes both the mechanism (`jj diff`) and the fallback (artifacts). When `vcs-wrap-up` is not in the checklist (no task changes tracked), `vcs_permission` is empty and the LLM has no VCS access during `generate-docs`. The instruction is then impossible to follow literally.

The mitigation is partial: if `vcs-wrap-up` IS in `doneActions` (pending), `vcs_permission` grants VCS access at prompt-injection time, so `jj diff` works during `generate-docs`. But when `vcs-wrap-up` is absent, the LLM is left without specific guidance.

Fix: restore the artifact fallback — e.g., "Use the spec, plan, and verify artifacts to describe what was built; if VCS access is available, also inspect `jj diff` or `git diff` for the actual file list."

---

## Recommendations

- **Fix Minor #1 and #2 in a follow-up task** — both are small line-level changes and low-risk. Minor #1 in particular affects developer UX when debugging a stale session.
- **Consider a headless-mode close path.** When `closeConfirmation: true` but `ctx.hasUI` is false, the issue never closes. For now this is a known limitation of the headless environment, but if headless usage becomes common, an auto-close flag on the `SignalResult` (no dialog required) would close this gap.
- **`showDoneChecklist` on Escape stores `[]` silently.** A user who presses Escape to dismiss the checklist ends up in `done` phase with `doneActions: []` and no feedback. The prompt won't inject done-phase guidance (both arrays are 0). Consider logging a notification or keeping the checklist open.

---

## Assessment

**ready**

All 24 acceptance criteria are implemented correctly. Tests are meaningful — they cover real behavior (disk state transitions, UI keypress simulation) rather than mocks of implementation internals. The `onAgentEnd` scraping removal is clean and complete. The three Minor findings are all contained, non-breaking issues that can be addressed in a follow-up without blocking merge.
