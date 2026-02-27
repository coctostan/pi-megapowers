## 2026-02-26 — #050 Agent Context & Awareness

- **Two parallel output surfaces need separate explicit tests**: `buildIdlePrompt` and `renderDashboardLines` both need to show ROADMAP/milestones — one was implemented, one was silently missed because only the prompt surface had a test. When a feature appears in both injected prompt and dashboard widget, write independent tests for each.

- **Tool schema changes don't take effect mid-session**: Adding `phase_back` to `register-tools.ts` (Task 9) doesn't make it callable in the *current* PI session — the outer framework's tool registry loads at startup. Trying to call `megapowers_signal({ action: "phase_back" })` in the same session that implemented it still fails schema validation.

- **`[no-test]` prompt template tasks need grep verification before task_done**: AC12, AC13, and AC16 were all simple text fixes that `grep` would have confirmed in seconds — all three slipped past task completion without verification, costing a full verify-then-fix cycle.

- **`handlePhaseBack` is a thin delegate**: backward transitions don't need their own transition logic — `handlePhaseNext(cwd, jj, target)` already accepts an explicit `target` argument, so `handlePhaseBack` is just a static lookup table (`{review→plan, verify→implement, code-review→implement}`) plus a delegate call.

- **Code-review is a valid salvage phase for small verify failures**: when verify finds < 5 targeted fixes (text changes + one new test) and `phase_back` isn't callable, advancing to code-review and fixing inline is cleaner than fighting the workflow — keep the fix scope under ~10 lines so the code-review narrative stays coherent.
