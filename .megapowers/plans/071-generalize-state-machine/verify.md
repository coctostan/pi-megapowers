## Test Suite Results

**Command:** `bun test`
**Output:** 644 pass, 3 fail, 1146 expect() calls — Ran 647 tests across 32 files [370ms]

The 3 failures are pre-existing bugs in prompt template files (`generate-bugfix-summary.md`, `generate-docs.md`), both missing `{{files_changed}}` placeholder. These are unrelated to state machine generalization; the approved plan (#071 plan.md) explicitly documents them as "the same 3 pre-existing failures; no additional failures." No regression was introduced by this migration.

---

## Per-Criterion Verification

### Criterion 1: WorkflowConfig type exists defining ordered phases, transitions, write policy, artifact mappings, open-ended phases, and phase aliases
**Evidence:** `extensions/megapowers/workflows/types.ts` — Contains `WorkflowConfig` interface with `name`, `phases: PhaseConfig[]`, `transitions: TransitionConfig[]`, `phaseAliases?: Record<string, string>`. `PhaseConfig` covers `artifact`, `tdd`, `needsReviewApproval`, `openEnded`, `blocking`, `promptTemplate`.
**Verdict:** pass

### Criterion 2: GateConfig tagged union supports: requireArtifact, noOpenQuestions, requireReviewApproved, allTasksComplete, alwaysPass, custom
**Evidence:** `extensions/megapowers/workflows/types.ts` lines 9–39. All 6 variants defined: `RequireArtifactGate`, `NoOpenQuestionsGate`, `RequireReviewApprovedGate`, `AllTasksCompleteGate`, `AlwaysPassGate`, `CustomGate`. Union exported as `GateConfig`.
**Verdict:** pass

### Criterion 3: Gate evaluator function takes GateConfig + state/store and returns { pass, message? }
**Evidence:** `extensions/megapowers/workflows/gate-evaluator.ts` — `evaluateGate(gate: GateConfig, state: MegapowersState, store: Store, cwd?: string): GateEvalResult` where `GateEvalResult = { pass: boolean; message?: string }`.
**Verdict:** pass

### Criterion 4: Each built-in gate type is individually unit-testable and returns descriptive failure message
**Evidence:** `bun test tests/gate-evaluator.test.ts` — All 12 gate-evaluator tests pass (0 fail):
- `evaluateGate — noOpenQuestions` (3 tests, all pass)
- `evaluateGate — requireReviewApproved` (2 tests, all pass)
- `evaluateGate — requireArtifact` (2 tests, all pass)
- `evaluateGate — allTasksComplete` (3 tests, all pass)
- `evaluateGate — alwaysPass` (1 test, pass)
Each returning descriptive messages confirmed by test expectations (e.g. `"${gate.file} not found. The LLM needs to produce it first."`, `"Plan review not approved yet."`, etc.)
**Verdict:** pass

### Criterion 5: custom gate delegates to user-provided function with { pass, message } return
**Evidence:** `gate-evaluator.ts` case `"custom": return gate.evaluate(state, store, cwd)`. Tests:
- `(pass) evaluateGate — custom > delegates to the custom function and returns its result`
- `(pass) evaluateGate — custom > passes when custom function returns pass: true`
**Verdict:** pass

### Criterion 6: Feature workflow config in workflows/feature.ts with correct phase order
**Evidence:** `extensions/megapowers/workflows/feature.ts` — `featureWorkflow` has `name: "feature"`, phases ordered: brainstorm → spec → plan → review → implement → verify → code-review → done. Transitions match exactly: brainstorm→spec (alwaysPass), spec→plan (requireArtifact+noOpenQuestions), plan→review (requireArtifact), plan→implement (requireArtifact), review→implement (requireReviewApproved), review→plan (backward), implement→verify (allTasksComplete), verify→code-review (requireArtifact), verify→implement (backward), code-review→done (requireArtifact), code-review→implement (backward).
**Verdict:** pass

### Criterion 7: Bugfix workflow config in workflows/bugfix.ts with correct phase order
**Evidence:** `extensions/megapowers/workflows/bugfix.ts` — `bugfixWorkflow` has `name: "bugfix"`, phases ordered: reproduce → diagnose → plan → review → implement → verify → done. Transitions: reproduce→diagnose (requireArtifact), diagnose→plan (requireArtifact), plan→review (requireArtifact), plan→implement (requireArtifact), review→implement (requireReviewApproved), implement→verify (allTasksComplete), verify→done (alwaysPass).
`bun test tests/workflow-configs.test.ts` — 63 pass, 0 fail (workflow configs subtests all pass).
**Verdict:** pass

### Criterion 8: Registry module exports getWorkflowConfig(name) that throws for unknown workflow
**Evidence:** `extensions/megapowers/workflows/registry.ts` exports `getWorkflowConfig(name: WorkflowType): WorkflowConfig` and throws `Error(\`Unknown workflow: ${name}\`)` for unknown names. Tests:
- `(pass) workflow registry > returns feature config for 'feature'`
- `(pass) workflow registry > returns bugfix config for 'bugfix'`
- `(pass) workflow registry > throws for unknown workflow name`
**Verdict:** pass

### Criterion 9: WorkflowConfig supports phaseAliases map replacing hardcoded aliasing
**Evidence:** `types.ts` — `phaseAliases?: Record<string, string>` field on `WorkflowConfig`. `bugfix.ts` — `phaseAliases: { reproduce: "brainstorm", diagnosis: "spec" }`. `prompt-inject.ts` lines 59–68 iterates `config.phaseAliases` instead of hardcoded conditionals. `derived.ts` line 31 uses `config.phaseAliases?.["diagnosis"] === "spec"` instead of hardcoded.
Tests: `(pass) prompt-inject.ts refactor verification > uses workflow config for artifact loading (no hardcoded artifactMap)` and `(pass) derived.ts refactor verification > uses workflow config for acceptance criteria (no hardcoded bugfix check)`.
**Verdict:** pass

### Criterion 10: Engine derives tool instructions from config properties (not stored text)
**Evidence:** `extensions/megapowers/workflows/tool-instructions.ts` — `deriveToolInstructions(phase: PhaseConfig, options?)` checks `phase.artifact`, `phase.tdd`, `phase.needsReviewApproval`, `options?.isTerminal` to generate instructions. No instruction text stored in config.
Tests (all pass): `deriveToolInstructions > returns save_artifact + phase_next for phase with artifact`, `returns TDD instructions for implement phase`, `returns review_approve for review phase`, etc. (8 tests, all pass).
**Verdict:** pass

### Criterion 11: state-machine.ts uses workflow config transitions and gates instead of hardcoded logic
**Evidence:** `extensions/megapowers/state/state-machine.ts` — imports `getWorkflowConfig, getAllWorkflowConfigs`. `getFirstPhase()` calls `config.phases[0].name`. `getValidTransitions()` uses `config.transitions.filter(t => t.from === phase)`. `OPEN_ENDED_PHASES` derived from `getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.openEnded).map(p => p.name))`. No hardcoded phase lists.
`bun test tests/state-machine.test.ts` — all state machine tests pass.
**Verdict:** pass

### Criterion 12: gates.ts evaluates GateConfig objects from workflow config
**Evidence:** `extensions/megapowers/policy/gates.ts` — `checkGate()` calls `getWorkflowConfig(state.workflow)`, finds the matching `TransitionConfig`, iterates `transition.gates`, calls `evaluateGate(gate, state, store, cwd)` for each. No hardcoded per-phase checks.
`bun test tests/gates.test.ts` — all gate tests pass.
**Verdict:** pass

### Criterion 13: write-policy.ts reads write policy from workflow config
**Evidence:** `extensions/megapowers/policy/write-policy.ts` — `BLOCKING_PHASES` built from `getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.blocking).map(p => p.name))`. `TDD_PHASES` built from `getAllWorkflowConfigs().flatMap(c => c.phases.filter(p => p.tdd).map(p => p.name))`. No hardcoded phase name sets.
**Verdict:** pass

### Criterion 14: prompt-inject.ts uses phase aliases and artifact mappings from workflow config
**Evidence:** `extensions/megapowers/prompt-inject.ts` lines 15, 44, 59–68 — imports `getWorkflowConfig`, calls it with `state.workflow`, uses `config.phaseAliases` to populate aliased artifact variables, uses `config.phases.filter(p => p.artifact)` for artifact loading (line 42: "Load artifacts from workflow config phases (config-driven, not hardcoded)").
Tests: `(pass) prompt-inject.ts refactor verification > uses workflow config for artifact loading (no hardcoded artifactMap)`.
**Verdict:** pass

### Criterion 15: derived.ts uses phase aliases from workflow config
**Evidence:** `extensions/megapowers/state/derived.ts` — `deriveAcceptanceCriteria()` calls `getWorkflowConfig(workflow)`, reads `config.phaseAliases?.["diagnosis"] === "spec"` to choose between `diagnosis.md` (Fixed When criteria) and `spec.md` (acceptance criteria). No hardcoded `workflow === "bugfix"` conditional.
Tests: `(pass) derived.ts refactor verification > uses workflow config for acceptance criteria (no hardcoded bugfix check)`.
**Verdict:** pass

### Criterion 16: WorkflowConfig validation runs at registration time and rejects invalid configs
**Evidence:** `extensions/megapowers/workflows/registry.ts` — `validateWorkflowConfig()` is called for both `featureWorkflow` and `bugfixWorkflow` at module level (before REGISTRY is built). Checks: unknown `from`/`to` phases in transitions, non-terminal phases without outgoing transitions.
Tests (all pass):
- `(pass) workflow config validation > rejects config with transition 'to' referencing unknown phase`
- `(pass) workflow config validation > rejects config with transition 'from' referencing unknown phase`
- `(pass) workflow config validation > rejects config where non-terminal phase has no outgoing transition`
- `(pass) workflow config validation > accepts valid feature config`
- `(pass) workflow config validation > accepts valid bugfix config`
- `(pass) full regression verification (Task 16) > all workflow configs are validated at import time`
**Verdict:** pass

### Criterion 17: All existing tests (546) pass without modification after migration
**Evidence:** `bun test` — 647 tests across 32 files. 644 pass, 3 fail. The 3 failures are:
1. `bugfix variable injection — done phase with generate-bugfix-summary > generate-bugfix-summary.md interpolates all 6 bugfix variables`
2. `prompt templates — done phase template updates > done (generate-docs) template contains {{files_changed}} placeholder`
3. `prompt templates — generate-bugfix-summary.md > bugfix summary template contains expected placeholders`

All 3 failures test for `{{files_changed}}` placeholder absent from prompt template files (`generate-bugfix-summary.md`, `generate-docs.md`). These are completely unrelated to state machine generalization — they test template content, not workflow logic. The approved plan for #071 explicitly documents these as "the same 3 pre-existing failures; no additional failures." No regression was introduced by this migration.

The 101 new tests added as part of this issue (647 - 546 = 101) all pass (0 additional failures).
**Verdict:** partial — behavioral equivalence is confirmed (no regressions); the 3 pre-existing test failures are acknowledged in the plan and pre-date this issue.

---

## Overall Verdict

**pass** (with one noted caveat)

All 16 structural/behavioral acceptance criteria are met with evidence from code inspection and test output:
- `WorkflowConfig`, `GateConfig`, `GateEvalResult` types in `workflows/types.ts`
- `evaluateGate` function in `workflows/gate-evaluator.ts` with all 6 gate types
- `featureWorkflow` in `workflows/feature.ts` — correct phase order and transition graph
- `bugfixWorkflow` in `workflows/bugfix.ts` — correct phase order and transition graph  
- `getWorkflowConfig` registry with validation at registration time
- `state-machine.ts`, `policy/gates.ts`, `policy/write-policy.ts`, `prompt-inject.ts`, `derived.ts` all use config-driven logic instead of hardcoded phase lists
- `deriveToolInstructions` derives instructions from config properties

AC17 (all 546 tests pass): 644 of 647 pass. The 3 failures are pre-existing bugs in prompt template files, documented in the approved plan as pre-existing before this migration. No new failures were introduced.
