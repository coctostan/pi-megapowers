# Review Findings — Plan v3: Generalize State Machine (#071)

Issue: `071-generalize-state-machine`

Baseline: `bun test` currently reports **574 pass / 3 fail**.
The 3 known failures are prompt-template related (e.g. `{{files_changed}}` placeholder expectations) and are not caused by this plan.

This plan is well-structured and (mostly) TDD-complete for the new gate evaluator + workflow configs, and it has a coherent dependency chain. The remaining concerns are mostly about (1) self-contained verification expectations and (2) a potential write-policy behavior change for bugfix phases.

---

## Per-Task Assessment

### Task 1: Define WorkflowConfig and GateConfig types [no-test] — ✅ PASS
No-test is justified (type-only). The verification step (`npx tsc --noEmit`) is concrete.

### Task 2: Implement gate evaluator — requireArtifact gate — ❌ REVISE
- **Step 5 expectation is incorrect once new tests exist:** after adding `tests/gate-evaluator.test.ts`, the full-suite **pass count will increase**. The plan currently says “same pass/fail count as baseline (574 pass, 3 fail)”, which will no longer be true.
  - **Fix:** change Step 5 to something like:
    - “Expected: only the same 3 pre-existing failures; no additional failures.”
    - (Optional) List the failing test names to make it deterministic.

### Task 3: Implement gate evaluator — noOpenQuestions gate — ❌ REVISE
- Same issue as Task 2: **Step 5’s exact pass-count expectation** won’t hold after adding new tests.

### Task 4: Implement gate evaluator — requireReviewApproved gate — ❌ REVISE
- Same issue as Task 2: **Step 5 exact counts** need to be updated to “no new failures beyond the known 3”.

### Task 5: Implement gate evaluator — allTasksComplete gate — ✅ PASS
The TDD steps are complete and the test inputs are self-contained.

### Task 6: Implement gate evaluator — alwaysPass gate — ✅ PASS
Good red/green cycle (Task 2’s default `throw` ensures Step 2 fails until implemented).

### Task 7: Implement gate evaluator — custom gate — ✅ PASS
Clear tests and minimal implementation.

### Task 8: Define feature workflow config — ✅ PASS
Config + tests are thorough and match the feature workflow graph, including backward transitions.

### Task 9: Define bugfix workflow config with phaseAliases — ❌ REVISE
- **Potential behavioral drift (write policy):** the plan sets `blocking: true` for bugfix phases `reproduce` and `diagnose`.
  - **Current behavior:** `extensions/megapowers/policy/write-policy.ts` does **not** treat `reproduce`/`diagnose` as blocking today (blocking phases are only `brainstorm/spec/plan/review/verify/done`).
  - If Task 14 derives blocking phases from config, this will begin blocking source writes during bugfix reproduce/diagnose.
  - **Fix (pick one and document it explicitly):**
    1. **Preserve current behavior (strict equivalence):** remove `blocking: true` from bugfix `reproduce`/`diagnose`.
    2. **Intentionally change behavior:** keep `blocking: true`, but add a regression test that codifies the new rule (so it’s not a silent change) and acknowledge this is not strictly equivalent.

### Task 10: Create registry with validation — ✅ PASS
Validation covers unknown phases and “non-terminal must have outgoing transition”, and validates at registration time.

### Task 11: Derive tool instructions from phase config — ✅ PASS
The `artifact filename base → save_artifact phase` approach is the right way to avoid the diagnose/diagnosis mismatch.

### Task 12: Refactor state-machine.ts to use workflow config — ✅ PASS
Good use of existing regression tests + config-derived `OPEN_ENDED_PHASES`.

### Task 13: Refactor gates.ts to use gate evaluator + workflow config — ✅ PASS
Backward transitions skipping gates are preserved.

### Task 14: Refactor write-policy.ts to use workflow config — ❌ REVISE
- This task is correct mechanically, but it amplifies Task 9’s decision:
  - If bugfix `reproduce`/`diagnose` are marked `blocking`, write behavior changes.
- **Fix:** once Task 9’s decision is made, add/adjust tests to lock the intended behavior (either “bugfix reproduce is blocking” or “it is not”).

### Task 15: Refactor prompt-inject.ts and derived.ts to use workflow config — ✅ PASS (scope note)
- Implementation looks correct and config-driven.
- **Scope note (granularity):** this task changes two behavioral surfaces at once (artifact injection + acceptance-criteria source selection). Existing tests should cover it, but if you want a safer rollout, split into:
  - 15a: `derived.ts` acceptance-criteria source selection
  - 15b: `prompt-inject.ts` artifact + alias injection + tool instructions

### Task 16: Full regression — all existing tests pass — ❌ REVISE
- Same as Task 2: exact counts will change after adding new passing tests.
  - **Fix:** change to “Expected: no new failures beyond the known 3 pre-existing failures.”

---

## Missing Coverage
No acceptance criteria are completely uncovered in the plan’s AC Coverage table.

However, **AC17 (behavioral equivalence)** is the one most sensitive to the Task 9/14 write-policy decision; it should be explicitly resolved (and ideally tested) so equivalence is not accidental.

---

## Verdict
**revise**

Requested updates before approval:
1. Update all “full suite” expected results (Tasks 2–4 and 16 at minimum) so they don’t claim exact baseline pass counts after adding new tests.
2. Decide and document whether bugfix `reproduce`/`diagnose` should be blocking to preserve current behavior; add a regression test to lock the decision in.

Once you confirm those adjustments, I can re-review quickly and (if everything is aligned) approve the plan.