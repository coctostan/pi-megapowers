## Implementation Plan

### Task 1: Define open-ended phases constant

Add an `OPEN_ENDED_PHASES` set in `index.ts` (or `state-machine.ts`) containing `brainstorm`, `reproduce`, and `diagnose`. These phases suppress automatic phase-transition prompts.

**Files:** `extensions/megapowers/index.ts`

### Task 2: Guard the auto-transition in the message handler

In the `message` event handler, wrap the `handlePhaseTransition` call with a check: only auto-prompt if the current phase is NOT in `OPEN_ENDED_PHASES`.

**Files:** `extensions/megapowers/index.ts`
**Change:** ~line 425, add `if (!OPEN_ENDED_PHASES.has(state.phase))` before calling `handlePhaseTransition`

### Task 3: Ensure /phase next still works for all phases

Verify the `/phase next` command handler does NOT use the `OPEN_ENDED_PHASES` guard — it should always offer transitions regardless of phase type.

**Files:** `extensions/megapowers/index.ts` (command handler, ~line 493)

### Task 4: Add tests

Add tests verifying:
- Open-ended phases don't trigger auto-transition after message
- Gate-driven phases still trigger auto-transition after message
- `/phase next` works for both types

**Files:** `tests/index.test.ts` or integration-style test
