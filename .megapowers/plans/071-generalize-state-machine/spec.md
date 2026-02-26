# Spec: Generalize State Machine (#071)

## Goal

Replace the hardcoded feature/bugfix workflow logic scattered across multiple files with a declarative `WorkflowConfig` type and a generic engine that evaluates it. Each workflow becomes a single config object defining its phases, transitions, gates, write policy, prompts, and artifacts. Adding a new workflow means creating one config file and one import line — no core engine changes.

## Acceptance Criteria

1. A `WorkflowConfig` type exists defining: ordered phases, transitions (with gate conditions), write policy per phase, artifact mappings, open-ended phases, and phase aliases.

2. A `GateConfig` tagged union supports these gate types: `requireArtifact`, `noOpenQuestions`, `requireReviewApproved`, `allTasksComplete`, `alwaysPass`, and `custom` (accepts a function).

3. A gate evaluator function takes a `GateConfig` plus current state/store and returns `{ pass: boolean, message?: string }`.

4. Each built-in gate type (`requireArtifact`, `noOpenQuestions`, `requireReviewApproved`, `allTasksComplete`, `alwaysPass`) is individually unit-testable and returns a descriptive failure message on rejection.

5. A `custom` gate delegates to a user-provided function with the same `{ pass, message }` return signature.

6. A feature workflow config exists in `workflows/feature.ts` that produces the same phase order and transition graph as the current hardcoded feature workflow (brainstorm → spec → plan → review → implement → verify → code-review → done).

7. A bugfix workflow config exists in `workflows/bugfix.ts` that produces the same phase order and transition graph as the current hardcoded bugfix workflow (reproduce → diagnose → plan → review → implement → verify → done).

8. A registry module exports a `getWorkflowConfig(name)` function that returns the config for a given workflow name, and throws for unknown workflow names.

9. `WorkflowConfig` supports a `phaseAliases` map (e.g., `{ reproduce: "brainstorm", diagnosis: "spec" }`) that the engine uses to resolve phase-specific behavior, replacing the hardcoded aliasing in prompt-inject.ts and derived.ts.

10. The engine derives tool instructions for each phase from config properties (has artifact, is TDD phase, needs review approval) rather than storing instruction text in the config.

11. `state-machine.ts` uses the workflow config's transitions and gates instead of hardcoded phase-next logic.

12. `gates.ts` evaluates `GateConfig` objects from the workflow config instead of hardcoded per-phase gate checks.

13. `write-policy.ts` reads write policy from the workflow config instead of hardcoded phase-based rules.

14. `prompt-inject.ts` uses phase aliases and artifact mappings from the workflow config instead of hardcoded conditionals.

15. `derived.ts` uses phase aliases from the workflow config instead of hardcoded alias logic.

16. `WorkflowConfig` validation runs at registration time and rejects configs with missing transitions, unknown phases, or phases referenced in transitions that aren't in the phase list.

17. All existing tests (546) pass without modification after the migration, confirming behavioral equivalence.

## Out of Scope

- Adding new workflow types beyond feature and bugfix — this issue only generalizes the engine and migrates existing workflows.
- Runtime workflow discovery or dynamic loading — the registry uses static imports.
- UI changes — the UI reads from the same state shape; no user-facing changes.
- Changes to `state.json` schema — coordination data shape stays the same.
- Exposing workflow config to end users or making it user-editable.

## Open Questions

*(None)*
