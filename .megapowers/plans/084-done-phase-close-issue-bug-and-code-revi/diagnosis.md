# Diagnosis: Done-phase close-issue bug and code-review checklist timing

---

## Bug #081 — close-issue not executed in headless done phase

### Root Cause

**`showDoneChecklist` (ui.ts:81) treats "no TUI" as a no-op, leaving `doneActions = []` permanently.** The entire done-phase pipeline depends on `doneActions.length > 0` as its activation trigger. With `doneActions` empty, both downstream consumers silently skip:

1. `buildInjectedPrompt` (prompt-inject.ts:165) — `done.md` template NOT injected → LLM has no instructions
2. `onAgentEnd` (hooks.ts:102) — done actions NOT processed → `close-issue` never executes

The bug is a design assumption violation: the done-phase was designed with TUI as the only entry point. There is no fallback for headless sessions.

### Trace

```
megapowers_signal({ action: "phase_next" }) [code-review → done]
  → handlePhaseNext(cwd) [tool-signal.ts:246]
    → advancePhase(cwd) [phase-advance.ts]
      → gate: requireArtifact("code-review.md") — PASSES
      → transition(state, "done") [state-machine.ts:147] → doneActions = []
      → writeState(cwd, newState)
    → return { ok: true, newPhase: "done" }
  
  back in register-tools.ts:execute() [line 49-53]:
    → if (params.action === "phase_next")
    → currentState.phase === "done" → true
    → await showDoneChecklist(ctx, ctx.cwd)
         → state.phase === "done" ✓
         → !ctx.hasUI → true → return  ← EXIT, doneActions NEVER WRITTEN
  
  next session:
    → onBeforeAgentStart → buildInjectedPrompt
         → state.phase === "done" → true
         → state.doneActions.length > 0 → FALSE → done.md NOT injected
    → LLM has no instructions → narrates but does nothing
    → agent_end → onAgentEnd
         → state.doneActions.length > 0 → FALSE → skips everything
         → updateIssueStatus() NEVER CALLED
         → writeState({ activeIssue: null }) NEVER CALLED
```

**Result**: Issue stays `status: open`. `state.activeIssue` is not cleared. `/issue list` still shows the completed issue. Manual state intervention required.

### Affected Code

| File | Line | Role |
|------|------|------|
| `extensions/megapowers/ui.ts` | 81 | **Root**: `if (!ctx.hasUI) return;` — exits without writing doneActions |
| `extensions/megapowers/register-tools.ts` | 49–53 | Call site for `showDoneChecklist` |
| `extensions/megapowers/prompt-inject.ts` | 165 | Consumer 1: gates done.md injection on `doneActions.length > 0` |
| `extensions/megapowers/hooks.ts` | 102 | Consumer 2: gates all done action processing on `doneActions.length > 0` |

### Pattern Analysis

| | Working (TUI) | Broken (headless) |
|---|---|---|
| `ctx.hasUI` | `true` | `false` |
| `showDoneChecklist` result | writes `doneActions` | early-returns, writes nothing |
| `buildInjectedPrompt` | injects `done.md` | skips template entirely |
| `onAgentEnd` | processes `close-issue` | skips all actions |

**Design assumption violated**: `showDoneChecklist` was written assuming the TUI is always the mechanism for populating `doneActions`. No headless fallback exists.

### Fix

In `showDoneChecklist`, replace the early-return with auto-population of defaults:

```typescript
if (!ctx.hasUI) {
  // Headless: auto-select all default-checked items
  const doneActions = getDoneChecklistItems(state)
    .filter(i => i.defaultChecked)
    .map(i => i.key);
  writeState(cwd, { ...readState(cwd), doneActions });
  return;
}
```

This populates `doneActions` with the default set (`generate-docs`, `write-changelog`, `capture-learnings`, `push-and-pr`, `close-issue`), activating both downstream consumers uniformly.

---

## Bug #083 — Done-phase checklist fires synchronously inside tool call (UX timing)

### Root Cause

**`showDoneChecklist` is called inside the `execute()` function of the `megapowers_signal` tool (register-tools.ts:52), which runs synchronously during the LLM's streaming response.** The TUI checklist appears while the LLM turn is still active — before the user has seen the full code-review narrative. The user must commit to wrap-up actions before reading the review.

The `requireArtifact: code-review.md` gate (feature.ts:22) was added to ensure the review file exists before advancing — this is partially correct — but the gate does not fix when the checklist appears relative to the streaming response.

### Trace

```
LLM turn (code-review phase):
  [text streaming: "The implementation looks solid. Here are my findings..."]
  [tool call: write({ path: "code-review.md", content: "..." })]    ← review written
  [tool call: megapowers_signal({ action: "phase_next" })]
    → execute() fires immediately during LLM streaming turn
      → handlePhaseNext → gate passes → state.phase = "done"
      → showDoneChecklist(ctx, ctx.cwd)    ← BLOCKS tool response
           → await showChecklistUI(...)     ← TUI checklist rendered NOW
           ← user selects actions           ← CONCURRENTLY WITH STREAMING
           → doneActions written to state
      → tool returns: "Phase advanced to done."
  [LLM continues streaming its response]  ← too late, user already committed
```

The TUI checklist is shown as a modal interaction **inside the tool's `execute()`**, blocking the tool result until the user interacts. The LLM is paused waiting for the tool result while the user is navigating the checklist.

### Affected Code

| File | Line | Role |
|------|------|------|
| `extensions/megapowers/register-tools.ts` | 47–54 | **Root**: `showDoneChecklist` called inside `execute()`, mid-stream |
| `extensions/megapowers/ui.ts` | 78–93 | `showDoneChecklist` — the function that renders the TUI modal |
| `extensions/megapowers/hooks.ts` | 93 | `onAgentEnd` — fires AFTER the turn ends; the correct deferral target |

### Pattern Analysis

| | Current (broken timing) | Correct (deferred) |
|---|---|---|
| When checklist fires | Inside `execute()` — during tool call, mid-stream | After `agent_end` — LLM turn fully complete |
| User can read review? | No — checklist blocks before streaming ends | Yes — sees full LLM response first |
| UX flow | Interrupted, must decide before reading | Natural: read → then commit |

### Fix

Move `showDoneChecklist` from `register-tools.ts:execute()` to `onAgentEnd` in `hooks.ts`. In `onAgentEnd`, add a branch for `phase === "done" && doneActions.length === 0`:

```typescript
// onAgentEnd — NEW branch BEFORE existing done-actions processing
if (phase === "done" && state.doneActions.length === 0 && state.activeIssue) {
  if (ctx.hasUI && !state.doneChecklistShown) {
    await showDoneChecklist(ctx, ctx.cwd);
    writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });
  }
  return;  // don't process actions yet — next turn will execute them
}
```

The `doneChecklistShown` flag prevents infinite re-show if the user dismisses the checklist (Escape). Remove the `showDoneChecklist` call from `register-tools.ts:execute()`.

**Combining with #081 fix**: when `!ctx.hasUI`, `showDoneChecklist` auto-populates defaults (the #081 fix), so `doneActions` will be non-empty after the first call from `onAgentEnd`. No re-show problem for the headless case.

---

## Shared State Schema Change

Add `doneChecklistShown: boolean` to `MegapowersState`:
- Default: `false` in `createInitialState()`
- Reset: `false` in `transition()` on every phase change (already reset via spread + explicit)
- Set: `true` when `showDoneChecklist` is called from `onAgentEnd`
- 22 test files reference `createInitialState`/`MegapowersState` — all use spread/default so optional field is backward compatible

---

## Risk Assessment

### #081 fix risks

| Risk | Likelihood | Notes |
|------|-----------|-------|
| `push-and-pr` auto-runs in headless mode | Low | Satellite sessions exit early from the extension entirely (`isSatelliteMode → return` in index.ts:23-26) — they never reach this code |
| Auto-defaults wrong for some workflows | Low | `getDoneChecklistItems` is already workflow-aware (bugfix vs feature docs) |
| `capture-learnings` action runs unattended | Low | The action reads from last assistant message text — if no long text is present, it silently skips |

### #083 fix risks

| Risk | Likelihood | Notes |
|------|-----------|-------|
| `onAgentEnd` fires for every LLM turn (not just code-review) | Addressed | Guard: `phase === "done" && doneActions.length === 0 && !doneChecklistShown` |
| State schema change breaks 22 test files | Low | Adding optional boolean field with default — no destructuring failures expected |
| Checklist deferred means done phase takes 2 sessions | Expected | This is the CORRECT behavior: session 1 = code-review + advance, session 2 = done actions |
| `remove showDoneChecklist` from tool breaks something else | None | AC11 comment in register-tools.ts says "Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation" — this restriction goes away with the move |

### Related code that depends on `doneActions`

- `buildInjectedPrompt` (prompt-inject.ts:165) — gated on `doneActions.length > 0` ← benefits from both fixes
- `onAgentEnd` processing loop (hooks.ts:102–188) — all done actions ← no change needed
- `renderStatusText` (ui.ts:104) — shows `→ N actions` badge ← no change needed
- `getDoneChecklistItems` (ui.ts:58) — used by `showDoneChecklist` ← no change
- 4 state reset sites in `ui.ts:269,314,379` and `hooks.ts:113` ← reset `doneActions: []` correctly

---

## Fixed When

**#081:**
1. In headless mode (`ctx.hasUI === false`), `showDoneChecklist` writes `doneActions` with all default-checked items instead of returning early
2. `onAgentEnd` processes `close-issue` → `updateIssueStatus("done")` is called → state is reset to idle
3. `buildInjectedPrompt` injects `done.md` template in the subsequent session
4. Test: `onAgentEnd` with `hasUI=false` → `updateIssueStatus` is called + `activeIssue` becomes null

**#083:**
1. `showDoneChecklist` is NOT called inside `megapowers_signal execute()`
2. Checklist fires in `onAgentEnd` after the code-review turn completes
3. `doneChecklistShown` is set to `true` on first presentation, preventing re-show on dismiss
4. Test: mock `onAgentEnd` with `phase=done, doneActions=[], hasUI=true` → checklist is invoked; mock `onAgentEnd` again with `doneChecklistShown=true` → checklist NOT invoked again
