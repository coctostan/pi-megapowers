---
id: 69
type: feature
status: done
created: 2026-02-24T00:21:00.000Z
milestone: M5
priority: 1
---

# Enable backward phase transitions via LLM tools and slash commands

## Problem

The state machine defines backward transitions (`code-review → implement`, `verify → implement`, `review → plan`) but they are unreachable:

1. **`megapowers_signal({ action: "phase_next" })`** — always advances to the first valid transition (forward). Passes `undefined` as `targetPhase` to `advancePhase()`.
2. **`/phase next`** — calls the same `handlePhaseNext`, same behavior.
3. **`/phase <target>`** — not implemented. Only `/phase` (show status) and `/phase next` exist.
4. **No other tool or command** triggers `advancePhase(cwd, targetPhase)` with a specific target.

Result: backward transitions are dead code. When code-review finds structural problems or verify discovers missing requirements, there's no way to go back to implement or plan without manually editing `state.json`.

## Desired Behavior

### 1. Extend `megapowers_signal` to accept an optional target phase

```typescript
// tool-signal.ts
case "phase_next":
  return handlePhaseNext(cwd, jj, payload?.target);

function handlePhaseNext(cwd: string, jj?: JJ, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined, jj);
  // ...
}
```

LLM calls: `megapowers_signal({ action: "phase_next", target: "implement" })`

The state machine's `canTransition()` already validates the transition is legal. No new validation needed.

### 2. Extend `/phase` slash command

```
/phase              → show current phase
/phase next         → advance forward (existing)
/phase implement    → go to specific phase (new)
/phase plan         → go to specific phase (new)
```

Validates via `canTransition()` same as the tool.

### 3. Update megapowers-protocol.md

Add target parameter documentation:
```
megapowers_signal({ action: "phase_next" })              — advance to next phase
megapowers_signal({ action: "phase_next", target: "implement" })  — go to specific phase (including backward)
```

## Implementation

### tool-signal.ts
- `handleSignal` passes optional target from tool args to `handlePhaseNext`
- `handlePhaseNext` passes target to `advancePhase`
- ~5 lines changed

### index.ts — `/phase` command handler
- Parse args beyond "next" — if args is a valid phase name, call `advancePhase(cwd, args)`
- ~10 lines added

### megapowers-protocol.md
- Document the target parameter

### Prompt updates
- `code-review.md`, `verify.md` — replace "recommend to user" with actual tool call for backward transitions

## State reset on backward transitions

When going backward, some state needs resetting:
- `code-review → implement`: reset `currentTaskIndex` to first incomplete task (already handled in `transition()`)
- `verify → implement`: same
- `review → plan`: reset `reviewApproved` (already handled in `transition()`)

The existing `transition()` function already handles these resets. No additional logic needed.

## Files
- `extensions/megapowers/tool-signal.ts` — pass target to advancePhase (~5 lines)
- `extensions/megapowers/index.ts` — extend `/phase` command (~10 lines)
- `prompts/megapowers-protocol.md` — document target parameter
- `prompts/code-review.md` — use target parameter for needs-rework
- `prompts/verify.md` — use target parameter for failed criteria
