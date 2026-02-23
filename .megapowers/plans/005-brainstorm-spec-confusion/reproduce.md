## Reproduction Report

### Steps to Reproduce

1. Start a feature workflow and enter the brainstorm phase
2. Send any message (brainstorm output)
3. Observe: `handlePhaseTransition` is called, presenting "Phase 'brainstorm' — what next?" with "spec" as the only option
4. Decline by cancelling the select prompt
5. Send another brainstorm message
6. Observe: the same transition prompt appears again

### Actual Behavior

Every `message` event in `index.ts` (line ~425) unconditionally calls `ui.handlePhaseTransition()` whenever valid transitions exist. Since `brainstorm → spec` is always valid, every brainstorm output triggers the "move to spec?" prompt. This makes brainstorming feel rushed and interrupts the creative flow.

### Expected Behavior

Phase transition should only be offered:
- When the user explicitly requests it (e.g. `/phase next`)
- Or at most once, after being declined it should not prompt again until the user takes explicit action

### Root Cause Location

`extensions/megapowers/index.ts`, message handler (~line 425-430):

```typescript
// Interactive-only: offer phase transition and update dashboard
if (ctx.hasUI) {
  const validNext = getValidTransitions(state.workflow, phase);
  if (validNext.length > 0) {
    state = await ui.handlePhaseTransition(ctx, state, store, jj);
    // ...
  }
}
```

No guard to suppress repeated transition prompts during open-ended phases (brainstorm, reproduce, diagnose).

### Environment

- All phases with valid forward transitions are affected
- Most disruptive during brainstorm (single forward transition, always valid, no gate)
- Also affects reproduce and diagnose phases in bugfix workflow
