# Diagnosis

## Root Cause

Two gaps in the UI layer:

1. **`handlePhaseTransition` (line 449):** Notification is generic — `"Transitioned to: spec"` — no phase-specific guidance.

2. **`renderDashboardLines` (line 57):** Shows phase-specific content for `implement` (tasks/TDD), `verify`/`code-review` (criteria), and `done` (doneMode). But for **brainstorm, spec, plan, review, reproduce, diagnose** — zero guidance. Just the phase progress bar.

The rich guidance exists in prompt templates but is only injected on the next agent turn. The gap between transition and first message leaves the user with no context.

## Affected Code

| File | Function | What's missing |
|---|---|---|
| `extensions/megapowers/ui.ts` | `handlePhaseTransition()` (line 449) | Generic notification, no guidance |
| `extensions/megapowers/ui.ts` | `renderDashboardLines()` (line 57) | No guidance line for 6 phases |

## Risk Assessment

**Low risk.** Same pattern as issue 015. Add a `PHASE_GUIDANCE` map and a conditional dashboard block for phases without existing specific content. Won't affect implement/verify/done which already have their own blocks.