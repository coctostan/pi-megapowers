Here's the feature document:

---

# Feature: Generalize State Machine (#071)

## Summary

Replaced the hardcoded feature/bugfix workflow logic scattered across six files with a declarative `WorkflowConfig` type and a generic engine that evaluates it. Each workflow is now a single config object defining its phases, transitions, gate conditions, write policy, artifacts, and phase aliases. Adding a new workflow type requires only one new config file and one import line — no changes to any engine file.

## Design Decisions

**Declarative config over imperative switch/case.** Transition tables and gate logic were previously spread across `state-machine.ts`, `gates.ts`, `write-policy.ts`, `prompt-inject.ts`, and `derived.ts` as hardcoded `if`/`switch` blocks. The new model centralizes workflow definition in a `WorkflowConfig` object that the engine reads uniformly. This is more auditable, easier to extend, and eliminates the risk of updating one file but missing another.

**Gate as a composable tagged union.** Six named gate types (`requireArtifact`, `noOpenQuestions`, `requireReviewApproved`, `allTasksComplete`, `alwaysPass`, `custom`) compose freely on any transition via a flat array. The `custom` gate type supports arbitrary logic without needing a new named type. All gates are independently unit-testable.

**Registration-time validation, not runtime.** `validateWorkflowConfig` runs synchronously at module load (before the registry is built), so malformed configs crash at startup rather than silently producing wrong behavior later.

**Phase aliases over workflow-specific branches.** The bugfix workflow's `reproduce`/`diagnosis` naming is bridged to the shared `brainstorm`/`spec` template variables via a `phaseAliases` map in config, replacing hardcoded `if (workflow === "bugfix")` blocks in `prompt-inject.ts` and `derived.ts`.

**Tool instructions derived from config properties, not stored as text.** `deriveToolInstructions` inspects phase flags (`artifact`, `tdd`, `needsReviewApproval`, `isTerminal`) to generate the appropriate LLM guidance. No instruction text lives in the config objects.

**Behavioral equivalence preserved for bugfix `reproduce`/`diagnose`.** These phases deliberately omit `blocking: true` to match the pre-existing write policy, which allowed source writes during them. A regression test locks this decision.

## API / Interface

**New types (`extensions/megapowers/workflows/types.ts`):**
- `WorkflowConfig` — top-level workflow declaration
- `PhaseConfig` — per-phase properties (`artifact`, `tdd`, `needsReviewApproval`, `openEnded`, `blocking`, `promptTemplate`, `guidance`)
- `TransitionConfig` — from/to phase pair with gate array and optional `backward` flag
- `GateConfig` — tagged union: `requireArtifact | noOpenQuestions | requireReviewApproved | allTasksComplete | alwaysPass | custom`
- `GateEvalResult` — `{ pass: boolean; message?: string }`

**New functions:**
- `evaluateGate(gate, state, store, cwd?)` — evaluates a single `GateConfig`
- `getWorkflowConfig(name)` — returns config, throws for unknown names
- `getAllWorkflowConfigs()` — returns all registered configs (used for phase set derivation)
- `validateWorkflowConfig(config)` — run at registration time; throws descriptively on invalid configs
- `deriveToolInstructions(phase, options?)` — returns phase-appropriate LLM tool call guidance

**New workflow configs:**
- `featureWorkflow` (`workflows/feature.ts`) — brainstorm→spec→plan→review→implement→verify→code-review→done
- `bugfixWorkflow` (`workflows/bugfix.ts`) — reproduce→diagnose→plan→review→implement→verify→done

## Testing

101 new tests added across two new test files and four extended existing files. All 644 passing tests remained passing after migration (3 pre-existing failures in prompt template content are unrelated to this change).

**New test files:**
- `tests/gate-evaluator.test.ts` — 12 tests, one per gate type per scenario (fail/pass/edge), each asserting descriptive failure messages
- `tests/workflow-configs.test.ts` — 63 tests covering phase order, every transition, gate configs, backward flags, phaseAliases, blocking/TDD/open-ended flags, registry lookup, validation rejection/acceptance, and `deriveToolInstructions` output per phase

**Extended test files:**
- `tests/gates.test.ts` — added refactor verification asserting `getWorkflowConfig` is used (no hardcoded `BACKWARD_TARGETS`)
- `tests/state-machine.test.ts` — added verification asserting no `FEATURE_TRANSITIONS`/`BUGFIX_TRANSITIONS` constants
- `tests/prompt-inject.test.ts` — added verification asserting no `artifactMap` or `PHASE_TOOL_INSTRUCTIONS`
- `tests/tool-overrides.test.ts` — added behavioral-equivalence tests for `reproduce`/`diagnose` write policy; refactor verification

## Files Changed

**New files:**
- `extensions/megapowers/workflows/types.ts` — `WorkflowConfig`, `GateConfig`, `PhaseConfig`, `TransitionConfig`, `GateEvalResult` type definitions
- `extensions/megapowers/workflows/feature.ts` — feature workflow config (phases + 11 transitions)
- `extensions/megapowers/workflows/bugfix.ts` — bugfix workflow config with `phaseAliases`
- `extensions/megapowers/workflows/gate-evaluator.ts` — `evaluateGate` generic gate execution
- `extensions/megapowers/workflows/registry.ts` — `getWorkflowConfig`, `getAllWorkflowConfigs`, `validateWorkflowConfig`
- `extensions/megapowers/workflows/tool-instructions.ts` — `deriveToolInstructions` config-driven LLM guidance
- `tests/gate-evaluator.test.ts` — gate evaluator unit tests
- `tests/workflow-configs.test.ts` — workflow config, registry, validation, and tool instruction tests

**Modified files:**
- `extensions/megapowers/state/state-machine.ts` — `getValidTransitions`/`getFirstPhase`/`OPEN_ENDED_PHASES` now derived from workflow config
- `extensions/megapowers/policy/gates.ts` — `checkGate` delegates to `getWorkflowConfig` + `evaluateGate`; removed hardcoded switch
- `extensions/megapowers/policy/write-policy.ts` — `BLOCKING_PHASES`/`TDD_PHASES` sets derived from all registered configs
- `extensions/megapowers/prompt-inject.ts` — artifact loading and alias variable expansion driven by config; tool instructions from `deriveToolInstructions`
- `extensions/megapowers/state/derived.ts` — acceptance criteria source file resolved via `phaseAliases` rather than hardcoded `workflow === "bugfix"`
- `tests/gates.test.ts` — refactor verification test added
- `tests/state-machine.test.ts` — refactor verification test added
- `tests/prompt-inject.test.ts` — refactor verification tests added
- `tests/tool-overrides.test.ts` — behavioral equivalence and refactor verification tests added

---

Looks good to me — shall I save this?