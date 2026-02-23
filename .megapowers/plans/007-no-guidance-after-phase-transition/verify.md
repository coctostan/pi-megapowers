## Test Suite Results
```
335 pass
0 fail
598 expect() calls
Ran 335 tests across 15 files. [66.00ms]
```

## Per-Criterion Verification

### Criterion 1: `handlePhaseTransition` shows phase-specific guidance in notification
**Evidence:** Line 462 of `ui.ts`: `ctx.ui.notify("Transitioned to: ${targetPhase}. ${guidance}", "info")` where `guidance` is looked up from `PHASE_GUIDANCE`. Test `"provides phase-specific guidance after transition"` passes — confirms notification contains "send" after brainstorm→spec transition.
**Verdict:** ✅ pass

### Criterion 2: `renderDashboardLines` shows guidance for phases without existing content
**Evidence:** Lines 88-93 of `ui.ts`: conditional block adds `PHASE_GUIDANCE[state.phase]` for phases that aren't `done` or `implement` and have no planTasks. Test `"shows phase instruction in dashboard after transition"` passes — confirms dashboard contains "send" for spec phase. All 8 phases (brainstorm, spec, plan, review, reproduce, diagnose, verify, code-review) have entries in the map.
**Verdict:** ✅ pass

### Criterion 3: No regressions — implement/verify/done keep their existing content
**Evidence:** 335 pass, 0 fail. The guidance block is gated by `state.phase !== "done" && state.phase !== "implement" && !state.planTasks.length`, so existing dashboard content for implement (tasks/TDD), done (doneMode), and phases with planTasks is unaffected.
**Verdict:** ✅ pass

## Overall Verdict
**✅ pass** — Both gaps identified in the diagnosis are fixed. The notification now includes phase-specific guidance, and the dashboard shows a persistent instruction line for all phases that lacked one. 335 tests pass with zero regressions.