# Reproduction: Done-phase close-issue bug and code-review checklist timing

Two confirmed bugs. Both verified with passing unit tests in `tests/reproduce-084-batch.test.ts`.

---

## Bug #081 — close-issue not executed in prompt-driven / headless done phase

### Steps to Reproduce

1. Complete a feature workflow issue (all tasks done, verify done, code-review done)
2. Call `megapowers_signal({ action: "phase_next" })` from `code-review` → phase advances to `done`
3. `showDoneChecklist` fires in `register-tools.ts:52` — but `ctx.hasUI` is `false` (headless / pipeline / no TUI)
4. `showDoneChecklist` (ui.ts:81) hits `if (!ctx.hasUI) return;` and exits early
5. `state.doneActions` is never written — remains `[]`
6. On next session start, `buildInjectedPrompt` (prompt-inject.ts:165) checks `state.doneActions.length > 0` — false → **done.md template not injected**
7. LLM has no instructions for the done phase; narrates "I'm closing the issue" but does nothing
8. `onAgentEnd` (hooks.ts:102) checks `state.doneActions.length > 0` — false → **skips all done actions including close-issue**

### Expected Behavior

`close-issue` executes: `store.updateIssueStatus(slug, "done")` is called, `state.activeIssue` is reset to `null`, workflow ends cleanly.

### Actual Behavior

`state.doneActions` remains `[]`. Issue stays `status: open`. `state.activeIssue` is not cleared. No done-phase actions execute. The next `/issue list` still shows the completed issue as open.

### Evidence

```
// ui.ts:78-93
export async function showDoneChecklist(ctx: any, cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state.activeIssue || state.phase !== "done") return;
  if (!ctx.hasUI) return;  // ← EXIT POINT: doneActions never set
  ...
  writeState(cwd, { ...readState(cwd), doneActions });
}

// hooks.ts:102
if (phase === "done" && state.doneActions.length > 0) {  // ← always false
  ...
  if (doneAction === "close-issue") {
    store.updateIssueStatus(state.activeIssue, "done");  // ← never reached
    writeState(ctx.cwd, { ...createInitialState(), ... });
  }
}

// prompt-inject.ts:165
} else if (state.doneActions.length > 0) {  // ← false, done.md not injected
  const template = getPhasePromptTemplate("done");
  ...
}
```

Confirmed by tests:
- `BUG: showDoneChecklist is a no-op when ctx.hasUI is false, leaving doneActions empty` → PASSES (documents bug)
- `BUG: onAgentEnd skips close-issue when doneActions is empty (the consequence)` → PASSES (documents bug)
- `BUG: buildInjectedPrompt returns NO done template when doneActions is empty` → PASSES (documents bug)
- `CONTROL: onAgentEnd DOES close issue when doneActions contains close-issue` → PASSES (TUI path works)

### Failing Test (existing)

`tests/reproduce-084-batch.test.ts` — `#081 — close-issue not executed when no TUI (prompt-driven path)` describes block

Tests pass because they assert the buggy behavior. A fix test would assert:
- After fix, even with `hasUI=false`, the done-phase either (a) populates `doneActions` before the LLM session starts, or (b) `onAgentEnd` directly runs `close-issue` when `phase === "done"` without requiring `doneActions`.

### Reproducibility

**Always** — any headless run (pipeline subagent, no-TUI mode, satellite session) that completes a feature workflow will hit this path.

---

## Bug #083 — Code-review checklist fires synchronously inside tool call (UX timing)

### Steps to Reproduce

1. Be in `code-review` phase with a feature workflow issue
2. LLM writes `code-review.md` (satisfies the `requireArtifact` gate)
3. LLM calls `megapowers_signal({ action: "phase_next" })`
4. `register-tools.ts:execute()` runs `handlePhaseNext` → gate checks `code-review.md` exists → passes → state = `done`
5. Immediately inside same `execute()` call (lines 49-53):
   ```typescript
   if (params.action === "phase_next") {
     const currentState = readState(ctx.cwd);
     if (currentState.phase === "done") {
       await showDoneChecklist(ctx, ctx.cwd);  // ← fires here, mid-stream
     }
   }
   ```
6. TUI checklist appears **while the LLM is still streaming its response** containing the tool call
7. User is forced to select done-phase actions (push+PR, close-issue, generate-docs, etc.) before they can read the code-review in context
8. User selects actions → `state.doneActions` written → next session injects `done.md` template → LLM executes done actions

### Expected Behavior

User sees the full code-review response, has time to read the findings, THEN the done-phase checklist appears (on idle / next session start).

### Actual Behavior

Checklist appears inside the tool-call response, concurrent with the streaming LLM turn. The user must commit to wrap-up actions before the code-review findings are fully readable.

### Evidence

```typescript
// register-tools.ts:47-54
// AC11: Show done checklist when phase_next advances to done
if (params.action === "phase_next") {
  const currentState = readState(ctx.cwd);
  if (currentState.phase === "done") {
    await showDoneChecklist(ctx, ctx.cwd);  // ← synchronous, inside execute()
  }
}
```

The `requireArtifact` gate DOES exist and works:
```typescript
// feature.ts:22
{ from: "code-review", to: "done", gates: [{ type: "requireArtifact", file: "code-review.md" }] },
```
This prevents advancing without `code-review.md`, but does NOT fix the checklist timing — the checklist still fires during the same tool call that successfully advances the phase.

Confirmed by test:
- `UX-ISSUE: showDoneChecklist fires synchronously inside tool execute (timing concern)` → PASSES (documents the call site)

### Failing Test (existing)

`tests/reproduce-084-batch.test.ts` — `#083 — code-review artifact gate and done-checklist timing` describe block.

A fix test would assert that `showDoneChecklist` is NOT called from inside `register-tools.ts execute()` — instead it is deferred to `onSessionStart` or a similar hook that fires after the LLM turn completes.

### Reproducibility

**Always (when TUI is available)** — every code-review → done transition with a TUI context hits this path.

---

## Environment

- Runtime: Bun 1.3.9
- Key files:
  - `extensions/megapowers/ui.ts:78-93` — `showDoneChecklist`, early-exit on `!hasUI`
  - `extensions/megapowers/hooks.ts:102-118` — `onAgentEnd` done-action processing
  - `extensions/megapowers/prompt-inject.ts:165-172` — done template injection gate
  - `extensions/megapowers/register-tools.ts:47-54` — checklist called inside tool execute
  - `extensions/megapowers/workflows/feature.ts:22` — `requireArtifact` gate (partially addresses #083)
- Test file: `tests/reproduce-084-batch.test.ts` (14 tests, all passing, documenting current behavior)
