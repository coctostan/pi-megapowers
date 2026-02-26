# Plan Review Findings — Issue 071-generalize-state-machine

Baseline context: `bun test` currently reports **574 pass / 3 fail** (pre-existing prompt template failures). The plan targets a big-bang refactor, so the main risk is introducing subtle behavior drift while trying to “generalize” logic.

## Per-Task Assessment

### Task 1: Define WorkflowConfig and GateConfig types — ✅ PASS (minor revise recommended)
- The `[no-test]` justification is valid and includes a typecheck verification step.
- **Minor:** `phaseAliases?: Record<string, string>` is consistent with current alias needs, but the spec example mixes phase names (`reproduce`) and artifact concepts (`diagnosis`). Consider clarifying in the type comment whether keys are **phase names** or **artifact base names**.

### Task 2: Implement gate evaluator — requireArtifact gate — ✅ PASS
- TDD steps are complete.
- Failure mode and message are specific.

### Task 3: Implement gate evaluator — noOpenQuestions gate — ✅ PASS
- TDD steps are complete.
- Behavior matches the existing gate behavior.

### Task 4: Implement gate evaluator — requireReviewApproved gate — ✅ PASS
- TDD steps are complete.

### Task 5: Implement gate evaluator — allTasksComplete gate — ✅ PASS
- Test is self-contained and uses real plan parsing input.
- **Minor:** Step 1 adds new imports (`writeFileSync`, `mkdirSync`) mid-file; still executable, but ensure import ordering matches repo conventions.

### Task 6: Implement gate evaluator — alwaysPass gate — ❌ REVISE
- **TDD completeness violation:** Step 2 expects **PASS** (the test does not fail). The plan format requires Step 2 to verify a failing test.
- **Fix options (pick one):**
  1. **Remove Task 6** and instead cover `alwaysPass` as part of Task 2/3’s tests without making it a separate TDD task; or
  2. Change `evaluateGate` to be exhaustive (no permissive default), e.g. throw/return failure for unhandled gate types, making the `alwaysPass` test fail until implemented; or
  3. Mark Task 6 as `[no-test]` (but that weakens AC4 coverage for `alwaysPass`).

### Task 7: Implement gate evaluator — custom gate — ✅ PASS
- TDD steps are complete.

### Task 8: Define feature workflow config — ❌ REVISE
- The tests are thorough and self-contained.
- **Missing prerequisite for later tasks:** Phase configs do **not** set `needsReviewApproval: true` on the `review` phase, but Task 11 expects derived tool instructions to include `review_approve`. This will fail prompt-inject tests (they assert `review_approve` is present).
- **Also:** The `promptTemplate` fields in the config are not used anywhere in the refactor tasks (see Task 15 gap). If prompt templates are meant to be in config (AC1), the plan should include a consumer refactor to use them.

### Task 9: Define bugfix workflow config with phaseAliases — ❌ REVISE
- **Bugfix alias naming mismatch risk:** Config uses `phaseAliases: { reproduce: "brainstorm", diagnosis: "spec" }` but bugfix phase is `diagnose` while the artifact is `diagnosis.md`. The plan later adds a special-case string hack for this.
  - This may work, but it’s fragile and not obviously “declarative”.
- **Gate correctness concern:** `verify → done` uses `alwaysPass`. Existing code does not require an artifact to advance verify→done for bugfix, so this is acceptable.
- **Same as Task 8:** `review` phase should set `needsReviewApproval: true` if tool instructions are derived from properties.
- **Important:** For bugfix phases, reproduce/diagnose currently save artifacts (`reproduce.md`, `diagnosis.md`). In the proposed phase configs, neither has `artifact` set, so Task 11’s artifact-derived instructions won’t prompt `save_artifact` for those phases.

### Task 10: Create registry with validation — ❌ REVISE
- The registry portion is fine.
- **Validation is incomplete vs AC16:** The spec requires rejecting configs with **missing transitions**. Current `validateWorkflowConfig()` only checks “from/to phase exists”.
  - Missing checks suggested by AC16:
    - Every phase except terminal (`done`) has at least one outgoing transition.
    - (Optional) Every transition’s `gates` is defined (even if empty).

### Task 11: Derive tool instructions from phase config — ❌ REVISE
- The “derive from properties” concept matches AC10, but the current draft has major mismatches with current behavior:
  1. **`needsReviewApproval` is never set** in Tasks 8/9, so review instructions won’t include `review_approve`.
  2. **Artifact phase naming mismatch for bugfix diagnosis:** the tool saves `diagnosis.md` when called with phase `"diagnosis"`, but the workflow phase is named `"diagnose"`. If you derive the tool phase name from `phase.name`, you’ll generate `diagnose.md` instead of `diagnosis.md`.
     - Recommendation: derive the save phase from the artifact filename (e.g., `diagnosis.md` → `diagnosis`).
  3. The test case for reproduce phase is currently too weak (only checks `phase_next`). It should assert `megapowers_save_artifact` is present if reproduce is intended to produce `reproduce.md`.

### Task 12: Refactor state-machine.ts to use workflow config — ❌ REVISE
- Transition table refactor is fine.
- **But it keeps `OPEN_ENDED_PHASES` hardcoded**, which undermines the core goal (“replace hardcoded logic”).
  - Better: build `OPEN_ENDED_PHASES` from the workflow configs at module load (it will still equal `{brainstorm, reproduce, diagnose}` and keep existing tests passing).

### Task 13: Refactor gates.ts to use gate evaluator + workflow config — ✅ PASS
- Uses existing regression tests.
- Behavior should remain equivalent if config matches old logic.

### Task 14: Refactor write-policy.ts to use workflow config — ✅ PASS (risk noted)
- Regression coverage relies on existing tests.
- **Risk:** `write-policy.ts` is intentionally “pure” and currently has no dependencies on workflow code. Importing the registry is still pure, but increases coupling. Acceptable, but worth noting.

### Task 15: Refactor prompt-inject.ts and derived.ts to use workflow config — ❌ REVISE
- Uses existing regression tests.
- **AC14/AC1 gap:** The plan still keeps a hardcoded `artifactMap` and does not use workflow config to drive artifact mappings. AC14 requires prompt-inject to use config-driven artifact mappings (not a fixed map).
- **Fragile aliasing implementation:** It hardcodes a `diagnosis` special-case to produce the right filename. This is a symptom of missing declarative metadata (artifact filename/base name).
- **Derived acceptance criteria selection is brittle:** checking `phaseAliases?.["diagnosis"] === "spec"` is indirect. A more declarative approach would be to store the “acceptance criteria source file” in workflow config, or at least store the “spec artifact filename” per workflow.

### Task 16: Full regression — all existing tests pass — ✅ PASS
- Good final safety gate.
- **Note:** It targets “same baseline” (574 pass / 3 fail). That’s fine as long as the refactor does not introduce new failures.

## Missing Coverage

No acceptance criteria are completely uncovered, **but** several are only partially satisfied in their current planned implementation:
- **AC1 (WorkflowConfig defines prompts/artifacts/write policy/open-ended/aliases):** plan defines these fields but doesn’t consistently *use* them (prompts/artifacts/open-ended).
- **AC10 (tool instructions derived from phase properties):** missing required phase metadata (review approval + artifact phase naming).
- **AC16 (validation rejects missing transitions):** current validator does not check missing transitions.

## Verdict: revise

The plan is close, but it needs targeted revisions before approval:

1. **Fix Task 6** so it follows TDD (Step 2 must fail) or remove it and cover `alwaysPass` elsewhere.
2. **Add required metadata to workflow configs** (Tasks 8/9):
   - `review` phase must set `needsReviewApproval: true`.
   - Bugfix `reproduce` and `diagnose` phases should declare artifacts (`reproduce.md`, `diagnosis.md`) if tool instructions and artifact loading are to be derived.
3. **Fix tool instruction derivation (Task 11)** to avoid the diagnose/diagnosis filename mismatch:
   - Derive save_artifact phase from the artifact filename base (e.g. `diagnosis.md` → `diagnosis`).
4. **Strengthen registry validation (Task 10)** to enforce “missing transitions” rejection per AC16.
5. **Make prompt-inject artifact loading config-driven (Task 15)** rather than using the hardcoded `artifactMap`.
6. **Derive `OPEN_ENDED_PHASES` from config (Task 12)** instead of leaving it hardcoded.

If you want, I can propose the exact edits to the plan tasks (minimal changes) while keeping the overall task count and dependency structure similar.
