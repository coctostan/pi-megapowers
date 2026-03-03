# Spec: Directory Restructure (#070)

## Goal

Restructure the flat `extensions/megapowers/` directory (29 source files) into concern-based subdirectories and slim `index.ts` from 870 lines to ~100 lines of thin wiring. This is a pure refactor — zero behavior changes, all 546 existing tests pass with only import path updates.

## Acceptance Criteria

**Directory structure:**

1. `extensions/megapowers/state/` contains `state-machine.ts`, `state-io.ts`, `store.ts`, `derived.ts` — moved from the flat root
2. `extensions/megapowers/tools/` contains `tool-signal.ts`, `tool-artifact.ts`, `tool-overrides.ts`, `tools.ts` — moved from the flat root
3. `extensions/megapowers/policy/` contains `write-policy.ts`, `gates.ts`, `phase-advance.ts` — moved from the flat root
4. `extensions/megapowers/subagent/` contains all 9 `subagent-*.ts` files — moved from the flat root
5. Files `ui.ts`, `prompts.ts`, `prompt-inject.ts`, `plan-parser.ts`, `spec-parser.ts`, `jj.ts`, `jj-messages.ts`, `satellite.ts`, `task-coordinator.ts` remain in the `extensions/megapowers/` root
6. No source files from the original flat layout remain in the root (except those listed in AC5 and `index.ts`, `commands.ts`, `hooks.ts`)

**index.ts extraction:**

7. `commands.ts` exports named handler functions for all 8 slash commands (mega, issue, triage, phase, done, learn, tdd, task) plus review
8. `hooks.ts` exports named handler functions for all 5 event hooks (session_start, before_agent_start, tool_call, tool_result, agent_end)
9. `satellite.ts` exports a `setupSatellite` function containing the satellite mode setup block previously inlined in `index.ts`
10. `index.ts` is ≤150 lines and contains only capability initialization, hook/tool/command registration, and subagent spawn glue

**Correctness:**

11. All existing tests pass (`bun test` exits 0) with no test logic changes — only import paths updated
12. All cross-module imports resolve correctly (no TypeScript compilation errors)
13. No public API changes — every function/type previously importable from a module is still importable from its new location

## Out of Scope

- Extracting subagent spawn glue from `index.ts` (~150 lines of pi-dependent orchestration)
- Reorganizing test files into subdirs (tests stay flat in `tests/`)
- Exposing slash commands as LLM tools (that's #043)
- Any behavior changes, new features, or new tests
- Barrel/index re-exports from subdirs

## Open Questions

None.
