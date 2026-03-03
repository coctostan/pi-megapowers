# Review Findings — Plan v2: Generalize State Machine (#071)

Issue: `071-generalize-state-machine`

Overall, the plan is close and well-structured, with clear AC mapping and a mostly solid TDD breakdown for the new gate evaluator + workflow configs. A couple of details look likely to cause behavioral drift vs the current system (even if tests might still pass), and a few steps could be tightened for self-containment.

---

## Per-Task Assessment

### Task 1: Define WorkflowConfig and GateConfig types [no-test] — ✅ PASS
No-test is justified (type-only). Verification step uses `npx tsc --noEmit` and is specific.

### Task 2: Implement gate evaluator — requireArtifact gate — ✅ PASS
TDD steps are complete and actionable.

### Task 3: Implement gate evaluator — noOpenQuestions gate — ✅ PASS
TDD steps are complete. Tests cover: fail, pass, and missing-file pass.

### Task 4: Implement gate evaluator — requireReviewApproved gate — ✅ PASS
TDD steps are complete and expectations are specific.

### Task 5: Implement gate evaluator — allTasksComplete gate — ❌ REVISE
- **Self-containment / correctness:** the plan says to “Add” `import { writeFileSync, mkdirSync } from "node:fs";` mid-task. The test file already imports from `node:fs` in Task 2 (`mkdtempSync`, `rmSync`). If implemented literally as an additional import later in the file, it can easily end up in the wrong place (imports must be at the top) or cause lint/format churn.
  - **Fix:** update the existing `node:fs` import to include `writeFileSync` and `mkdirSync` instead of adding a new import block.

### Task 6: Implement gate evaluator — alwaysPass gate — ✅ PASS
Good red/green cycle ensured by the Task 2 default `throw`.

### Task 7: Implement gate evaluator — custom gate — ✅ PASS
Clear test and minimal implementation.

### Task 8: Define feature workflow config — ❌ REVISE
- **Behavioral equivalence risk:** the current system loads `brainstorm.md` into `brainstorm_content` (see existing `artifactMap` in `extensions/megapowers/prompt-inject.ts`). The spec+plan prompt templates also reference `{{brainstorm_content}}` (`prompts/write-spec.md`, `prompts/write-plan.md`).
  - In the proposed `featureWorkflow`, `brainstorm` has **no** `artifact: "brainstorm.md"`, and Task 15 removes the hardcoded `artifactMap` in favor of config-driven loading. That combination will stop populating `brainstorm_content` for feature workflows, reducing spec/plan context.
  - **Fix option A (recommended):** declare `artifact: "brainstorm.md"` on the feature `brainstorm` phase.
  - **Fix option B:** keep brainstorm non-artifact, but then Task 15 must still load `brainstorm.md` via some config-level artifact mapping (i.e., introduce a separate artifact mapping concept not tied to “phase produces artifact”).

### Task 9: Define bugfix workflow config with phaseAliases — ✅ PASS
Matches current bugfix transitions/gates. `phaseAliases` matches AC9 (reproduce→brainstorm, diagnosis→spec).

### Task 10: Create registry with validation — ✅ PASS
Validation covers unknown phases and “non-terminal has outgoing transition” (good). Registration-time validation satisfies AC16.

### Task 11: Derive tool instructions from phase config — ❌ REVISE
- **Coupled to Task 8 fix:** if you adopt Task 8’s recommended fix (brainstorm declares `artifact: "brainstorm.md"`), then the test asserting brainstorm instructions “not to contain save_artifact” becomes incorrect.
- **Done-phase guidance regression risk:** current `PHASE_TOOL_INSTRUCTIONS.done` says to use `megapowers_save_artifact` for done-mode outputs. The proposed `deriveToolInstructions()` default would tell “phase_next” for a phase with no artifact/tdd/review flags, which includes `done`.
  - Even if `doneMode` templates contain save instructions, appending a generic “phase_next” message in `done` is misleading.
  - **Fix:** handle terminal phases (or specifically `done`) so the returned instructions match current behavior (“save outputs via megapowers_save_artifact”). If you want to avoid hardcoding phase names, consider deriving `isTerminal` from the workflow config (last phase) and passing that into `deriveToolInstructions`.

### Task 12: Refactor state-machine.ts to use workflow config — ✅ PASS
Dependencies look correct. Existing state-machine tests provide regression coverage.

### Task 13: Refactor gates.ts to use gate evaluator + workflow config — ✅ PASS
Good migration plan; backward transitions are preserved via `transition.backward`.

### Task 14: Refactor write-policy.ts to use workflow config — ✅ PASS
Config-derived `BLOCKING_PHASES` and `TDD_PHASES` are consistent with current behavior.

### Task 15: Refactor prompt-inject.ts and derived.ts to use workflow config — ❌ REVISE
- **Depends on Task 8 brainstorm artifact decision:** if artifact loading is “only PhaseConfig.artifact”, then feature `brainstorm_content` will no longer be injected unless brainstorm declares an artifact.
- **Done-phase tool instructions:** if Task 11 changes done instructions to “phase_next”, prompt-inject will start appending that to done-mode prompts.

### Task 16: Full regression — all existing tests pass — ✅ PASS
Command and baseline are explicit (`574 pass, 3 pre-existing fail`).

---

## Missing Coverage
None. AC1–AC17 are mapped to tasks in the plan, and every AC has at least one task.

---

## Verdict
**revise**

Main required changes before implementation:
1. Decide how brainstorm artifacts are represented in config so `brainstorm_content` keeps working for feature workflow after Task 15 removes the hardcoded artifact map.
2. Ensure done-phase tool instructions don’t regress into a generic “phase_next” guidance.
3. Minor cleanup in Task 5 about how imports are updated in `tests/gate-evaluator.test.ts`.
