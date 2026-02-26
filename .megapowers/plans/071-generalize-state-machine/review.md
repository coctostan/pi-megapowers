# Plan Review: Generalize State Machine (#071) — v4

## Per-Task Assessment

### Task 1: Define WorkflowConfig and GateConfig types — ✅ PASS
[no-test] justified — pure type definitions with type-check verification. Types are complete and well-documented.

### Task 2: Implement gate evaluator — requireArtifact gate — ✅ PASS
Full TDD cycle, all 5 steps present. Test code is complete. Default `throw` for unhandled types ensures proper red-green for later gates.

### Task 3: Implement gate evaluator — noOpenQuestions gate — ✅ PASS
All 5 steps present. Correctly imports `hasOpenQuestions` from spec-parser. Edge case "file does not exist → pass" matches current behavior.

### Task 4: Implement gate evaluator — requireReviewApproved gate — ✅ PASS
All 5 steps present. Matches current gates.ts behavior exactly.

### Task 5: Implement gate evaluator — allTasksComplete gate — ✅ PASS
All 5 steps present. Import fix (updating existing `node:fs` import) correctly called out. Uses `deriveTasks` matching current behavior.

### Task 6: Implement gate evaluator — alwaysPass gate — ✅ PASS
All 5 steps present. Properly benefits from Task 2's `throw` in default branch.

### Task 7: Implement gate evaluator — custom gate — ✅ PASS
All 5 steps present. Clean delegation pattern.

### Task 8: Define feature workflow config — ✅ PASS
Comprehensive test covering all transitions, phase flags, and gate configs. Adding `artifact: "brainstorm.md"` is an intentional behavioral addition (brainstorm gets `save_artifact` instructions). Won't break existing tests.

### Task 9: Define bugfix workflow config with phaseAliases — ✅ PASS
`blocking: false` for reproduce/diagnose is correct per current `write-policy.ts`. Task 14 adds regression test. No `review→plan` backward transition matches current `BUGFIX_TRANSITIONS`.

### Task 10: Create registry with validation — ✅ PASS
Module-level validation enforces AC16. `getAllWorkflowConfigs()` is well-designed for Tasks 12/14.

### Task 11: Derive tool instructions from phase config — ✅ PASS
`artifactSavePhase` fixes the `diagnose`/`diagnosis` naming mismatch (pre-existing bug). `isTerminal` handling for done phase is clean.

### Task 12: Refactor state-machine.ts to use workflow config — ✅ PASS
Clean replacement. `OPEN_ENDED_PHASES` derived from configs. Existing 60+ tests as regression.

### Task 13: Refactor gates.ts to use gate evaluator + workflow config — ✅ PASS (minor note)
The rewrite changes default behavior from "pass unknown transitions" to "fail unknown transitions." All existing transitions are explicitly defined in configs, so no breakage. Stricter default is an improvement.

### Task 14: Refactor write-policy.ts to use workflow config — ✅ PASS
Clean config-derived sets. Regression test for bugfix phases locks the behavioral decision. Minor note: test imports `canWrite` directly — implementer needs to add the import line.

### Task 15: Refactor prompt-inject.ts and derived.ts to use workflow config — ✅ PASS (minor notes)
- `derived.ts`: `config.phaseAliases?.["diagnosis"] === "spec"` is semantically equivalent to `workflow === "bugfix"`.
- `prompt-inject.ts`: Feature workflow will now load `brainstorm.md` into template vars (wasn't loaded before). Non-breaking — no template references it in other phases.

### Task 16: Full regression — ✅ PASS
Verification-only with clear pass/fail criteria.

---

## Missing Coverage

All 17 ACs covered. No gaps.

## Ordering & Dependencies

All correct. No cycles. All prereqs satisfied.

## Granularity

Well-scoped — one gate type per task, one config per workflow, one module per refactor.

## Self-Containment

Complete file paths, full code, exact run commands throughout.

## Verdict: **PASS** — Plan is ready for implementation.
