# Bug Report: No guidance after phase transition

## Steps to Reproduce
1. Activate an issue and enter a workflow
2. Run `/phase next` to transition (e.g., brainstorm → spec)
3. Observe the UI after transition

## Expected Behavior
After transitioning, the user should see actionable guidance — what the phase is about and what to do next ("send a message to begin"). This should persist in the dashboard.

## Actual Behavior
- Notification only says `"Transitioned to: spec"` — generic, no guidance
- Dashboard shows `Phase: brainstorm → ▶spec → plan → ...` — no instruction about what to do
- The rich prompt template is only injected on the NEXT agent turn, leaving the user staring at a blank prompt

## Environment
- Runtime: Bun 1.3.9
- File: `extensions/megapowers/ui.ts` — `handlePhaseTransition()` (line 449), `renderDashboardLines()` (line 49)

## Failing Tests
2 tests added in `tests/ui.test.ts`:
1. **`provides phase-specific guidance after transition`** — FAILS: notification is "Transitioned to: spec", no "send" instruction
2. **`shows phase instruction in dashboard after transition`** — FAILS: dashboard has no "send" instruction, only phase progress bar