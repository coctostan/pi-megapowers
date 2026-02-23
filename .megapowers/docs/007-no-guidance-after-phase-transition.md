

# Bugfix: No guidance after phase transition

## Bug Description
After transitioning to a new phase via `/phase next`, the user saw a generic notification ("Transitioned to: spec") and a blank input prompt with no indication of what to do. The rich prompt template guidance was only injected on the next agent turn, leaving a confusing gap where the user had no context about the phase's purpose or expected next action.

## Root Cause
Two functions in `ui.ts` had no awareness of phase-specific guidance:
1. `handlePhaseTransition` fired a generic `ctx.ui.notify("Transitioned to: ${phase}")` with no actionable instruction.
2. `renderDashboardLines` showed phase-specific content for `implement` (tasks/TDD), `done` (doneMode), but nothing for brainstorm, spec, plan, review, reproduce, diagnose, verify, or code-review — just the phase progress bar.

## Fix Applied
Added a `PHASE_GUIDANCE` map with short, actionable instructions for all 8 phases (e.g., `spec → "Send a message to write the spec."`). Used it in two places:
1. **Dashboard**: A conditional block in `renderDashboardLines` renders the guidance as a dimmed line for phases that don't already have their own detailed content (implement/done).
2. **Notification**: `handlePhaseTransition` appends the guidance to the transition notification: `"Transitioned to: spec. Send a message to write the spec."`

## Regression Tests
2 tests added in `tests/ui.test.ts` under `describe("handlePhaseTransition — post-transition guidance")`:

| Test | What it verifies |
|---|---|
| `provides phase-specific guidance after transition` | Notification contains "send" after brainstorm→spec transition |
| `shows phase instruction in dashboard after transition` | Dashboard output contains "send" when in spec phase |

## Files Changed
- `extensions/megapowers/ui.ts` — Added `PHASE_GUIDANCE` map, dashboard guidance block, enhanced transition notification
- `tests/ui.test.ts` — Added 2 regression tests for post-transition guidance