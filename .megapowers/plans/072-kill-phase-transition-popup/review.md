# Review: Plan 072-kill-phase-transition-popup (v2)

## Project Conventions Check
- `AGENTS.md` confirms TypeScript + Bun tests (`bun test`) with `tests/*.test.ts`.
- Plan uses correct runner and file conventions.

---

## Per-Task Assessment

### Task 1: Replace `doneMode` with `doneActions` — ✅ PASS
No blocking issues.

### Task 2: Update `ui.ts` references from `doneMode` to `doneActions` — ⚠️ REVISE
- Temporary reliance on `DONE_MODE_LABELS` is okay only if explicitly noted as transitional (removed in Task 11).
- Task bundles multiple behaviors; should be split for cleaner TDD scope.

### Task 3: Update `hooks.ts` and `prompt-inject.ts` references — ✅ PASS
No blocking issues.

### Task 4: `phase_back` resolves backward transitions — ✅ PASS
No blocking issues.

### Task 5: `phase_back` error paths — ❌ REVISE
- TDD violation: Step 2 says expected PASS (confirmation-only), not a failing-first cycle.
- Fix by merging into Task 4 pre-implementation tests or converting to true red→green.

### Task 6: `phase_next` default target skips backward transitions — ✅ PASS
No blocking issues.

### Task 7: Register `phase_back` in tool schema — ✅ PASS
No blocking issues.

### Task 8: Remove popup calls from `onAgentEnd` — ✅ PASS
No blocking issues.

### Task 9: Done checklist items generation — ✅ PASS
No blocking issues.

### Task 10: Done checklist display and state storage — ❌ REVISE
- AC11 mismatch: spec requires checklist via `ctx.ui.custom()`, but task implements `ctx.ui.select()`.
- AC13/AC14 handling is good; UI mechanism must be changed to match AC11.

### Task 11: Remove `handlePhaseTransition`, `handleDonePhase`, `DONE_MODE_LABELS` — ✅ PASS
No blocking issues.

### Task 12: Done-phase prompt reads `doneActions` — ❌ REVISE
- Invalid artifact phases in prompt (`docs`, `changelog`, `bugfix-summary`) do not match allowed `megapowers_save_artifact` phases.
- AC17 needs explicit, executable agent-driven instructions for each action (especially close-issue).

### Task 13: Wire done checklist into phase transitions — ⚠️ REVISE
- Potential duplicate checklist triggering (`register-tools.ts` + `hooks.ts`) should be de-duplicated.
- `grep`-inside-test strategy for `doneMode` is brittle; replace with stable assertions or a separate verification step.

### Task 14: Update prompt files for `phase_back` [no-test] — ✅ PASS
- Valid no-test justification (prompt/docs changes).
- Includes explicit verification command.

---

## Missing Coverage
No AC is completely unmapped, but there are blocking quality gaps in mapped tasks:
- **AC11** not satisfied as written due to `ctx.ui.select()` instead of `ctx.ui.custom()`.
- **AC17** partially under-specified in executable tool terms.
- **AC16/AC17** at risk due to invalid phase names in Task 12 prompt instructions.

---

## Verdict
**revise**

## Required changes before approval
1. Fix Task 5 to follow strict red→green TDD (no confirmation-only task).
2. Update Task 10 to implement checklist with `ctx.ui.custom()` and test that path.
3. Correct Task 12 done prompt action instructions to use valid tools/allowed artifact phases and explicit close-issue execution.
4. Clarify Task 13 trigger ownership to avoid duplicate checklist presentation.
5. Tighten oversized tasks where practical (especially Task 2/13) for one-test/one-implementation flow.
