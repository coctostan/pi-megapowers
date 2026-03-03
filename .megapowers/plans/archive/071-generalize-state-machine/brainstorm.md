# Brainstorm: Generalize State Machine (#071)

## Approach

Replace the hardcoded feature/bugfix workflow logic scattered across 7 files with a declarative `WorkflowConfig` type. Each workflow (feature, bugfix) becomes a single config object defining its phases, transitions, gates, write policy, prompts, and artifacts. A generic engine evaluates these configs — the engine doesn't know what "feature" or "bugfix" means, it just follows the config.

Workflow configs live in per-workflow files (`workflows/feature.ts`, `workflows/bugfix.ts`) with an explicit registry that imports and collects them. Adding a future workflow means creating a new file and one import line — no core changes needed.

Gates are fully declarative using a small tagged union of gate types (requireArtifact, noOpenQuestions, requireReviewApproved, allTasksComplete, alwaysPass) plus a `custom` escape hatch for exotic cases. Tool instructions injected into prompts are derived by the engine from phase properties (has artifact? is TDD phase? needs review approval?) rather than stored in config. Migration is big-bang — build the new engine, swap internals, validate against the existing 546 tests.

## Key Decisions

- **Fully declarative gates (option 2b)** — 5 built-in gate types cover all current transitions, plus a `custom` function escape hatch for future needs
- **Per-workflow files with explicit registry (option 2)** — clean separation, easy to find, statically typed. No runtime discovery overhead.
- **Tool instructions derived, not configured** — the engine generates phase-specific tool instructions from phase properties (artifact, TDD, review). Keeps config clean, ensures instructions always match actual behavior.
- **Big-bang migration** — existing 546 tests serve as regression suite. Build new engine, swap internals, run tests. No duplication period.
- **Bugfix phase aliasing in config** — `phaseAliases` map (e.g., reproduce→brainstorm) replaces hardcoded aliasing logic in prompt-inject.ts and derived.ts

## Components

1. **`WorkflowConfig` type** — defines the shape: phases, transitions (with gates), writePolicy, prompts, artifacts, openEndedPhases, phaseAliases
2. **`GateConfig` tagged union** — `requireArtifact(file)`, `noOpenQuestions(file)`, `requireReviewApproved`, `allTasksComplete`, `alwaysPass`, `custom(fn)`
3. **Gate evaluator** — takes a `GateConfig` + state/store, returns pass/fail with message
4. **`workflows/feature.ts`** — feature workflow config object
5. **`workflows/bugfix.ts`** — bugfix workflow config object
6. **`workflows/registry.ts`** — exports map of workflow name → config, `getWorkflowConfig(name)` helper
7. **Refactored consumers** — state-machine.ts, gates.ts, write-policy.ts, prompts.ts, prompt-inject.ts, derived.ts, ui.ts all read from config via registry instead of hardcoded logic

## Testing Strategy

- **Existing 546 tests as regression** — the core validation. If behavior doesn't change, tests stay green.
- **New unit tests for gate evaluator** — each gate type tested in isolation with mock state/store
- **New unit tests for WorkflowConfig validation** — malformed configs (missing transitions, unknown phases) caught at registration time
- **Config-level tests** — verify feature and bugfix configs produce the same transition graph as the old hardcoded logic
- **Tool instruction derivation tests** — verify the engine generates correct tool instructions from phase properties
