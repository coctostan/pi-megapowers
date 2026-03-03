## Files Reviewed
- `extensions/megapowers/workflows/types.ts` — new workflow/gate/type model.
- `extensions/megapowers/workflows/feature.ts` — feature workflow config (phases/transitions).
- `extensions/megapowers/workflows/bugfix.ts` — bugfix workflow config + aliases.
- `extensions/megapowers/workflows/registry.ts` — config registry + validation at import time.
- `extensions/megapowers/workflows/gate-evaluator.ts` — generic gate execution logic.
- `extensions/megapowers/workflows/tool-instructions.ts` — config-derived tool instruction generation.
- `extensions/megapowers/state/state-machine.ts` — transition/open-ended phase derivation from config.
- `extensions/megapowers/policy/gates.ts` — transition gate checks via config + evaluator.
- `extensions/megapowers/policy/write-policy.ts` — blocking/TDD phases derived from workflow config.
- `extensions/megapowers/prompt-inject.ts` — artifact + alias loading from workflow config.
- `extensions/megapowers/state/derived.ts` — acceptance criteria source resolved via aliases.
- `tests/workflow-configs.test.ts`, `tests/gate-evaluator.test.ts`, `tests/gates.test.ts`, `tests/state-machine.test.ts`, `tests/prompt-inject.test.ts`, `tests/derived.test.ts` — coverage for new config/evaluator behavior.

## Strengths
- Config-driven transition engine is clean and centralized (`extensions/megapowers/state/state-machine.ts:64-66`, `:93-97`), removing duplicated hardcoded transition tables.
- Gate evaluation is now composable and testable (`extensions/megapowers/workflows/gate-evaluator.ts:14-55`) with descriptive rejection reasons.
- Policy layer now delegates to workflow config + evaluator (`extensions/megapowers/policy/gates.ts:18-37`) and preserves backward-transition bypass behavior (`:26-29`).
- Write policy correctly derives blocking/TDD phase sets from registered configs (`extensions/megapowers/policy/write-policy.ts:38-45`) instead of static phase lists.
- Prompt injection is materially improved: artifact loading and alias variable expansion are config-driven (`extensions/megapowers/prompt-inject.ts:42-73`), and tool instructions are derived from phase flags (`:128-136`).
- Registration-time validation is in place and executed on import (`extensions/megapowers/workflows/registry.ts:30-32`).

## Findings

### Critical
None.

### Important
None.

### Minor
1. **Config fields are currently redundant/unwired**  
   - **File:line:** `extensions/megapowers/workflows/types.ts:66-67`, `extensions/megapowers/workflows/feature.ts:7-13`, `extensions/megapowers/workflows/bugfix.ts:7-12`, `extensions/megapowers/prompt-inject.ts:106`  
   - **What’s wrong:** `PhaseConfig.promptTemplate` and `PhaseConfig.guidance` are populated in workflow configs but prompt rendering still reads templates from `getPhasePromptTemplate(state.phase)` (phase-map based), so config values are not the source of truth.
   - **Why it matters:** This weakens the “add a workflow with config only” goal and can cause drift between config and runtime behavior.
   - **How to fix:** In `prompt-inject.ts`, resolve the active `phaseConfig` first and load `phaseConfig.promptTemplate` directly; either wire `guidance` to UI messaging or remove it from config until used.

2. **Validation misses a couple of defensive checks for future extensibility**  
   - **File:line:** `extensions/megapowers/workflows/registry.ts:7-27` (especially `:21`)  
   - **What’s wrong:** `validateWorkflowConfig` does not explicitly reject empty `phases` arrays and does not validate `phaseAliases` keys/targets.
   - **Why it matters:** A malformed future config can fail with less actionable errors (or silently mis-alias prompt variables).
   - **How to fix:** Add explicit checks for `config.phases.length > 0`; validate alias keys/targets against known phase names and/or known artifact base names.

3. **Acceptance-criteria alias resolution is still partly special-cased**  
   - **File:line:** `extensions/megapowers/state/derived.ts:31-33`  
   - **What’s wrong:** Logic specifically checks `phaseAliases["diagnosis"] === "spec"`.
   - **Why it matters:** Works for current workflows, but it is not fully generic for additional workflows/alias schemes.
   - **How to fix:** Add an explicit config property for criteria source (e.g., `acceptanceCriteriaArtifact`) or derive source artifact via a general alias-resolution helper.

## Recommendations
- Add one small validation-focused test block for malformed configs (empty phase list, invalid alias mapping).
- Follow up with a small refactor to make prompt template selection fully config-driven, then remove duplicate prompt mapping in `prompts.ts` if no longer needed.
- If extensibility is a near-term goal, formalize “criteria source artifact” in `WorkflowConfig` rather than inferring from a specific alias key.

## Assessment
ready

The migration is functionally solid and behaviorally equivalent for existing workflows. Full test run remains at 644 pass / 3 known pre-existing prompt-template failures (unchanged by this work). Findings are non-blocking maintainability/extensibility improvements and do not prevent merge.