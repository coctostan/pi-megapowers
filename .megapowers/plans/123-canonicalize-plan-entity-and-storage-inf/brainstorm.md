## Goal

The codebase contains three root-level plan infrastructure modules (`plan-store.ts`, `entity-parser.ts`, `plan-schemas.ts`) that duplicate functionality already canonically provided by their `state/` counterparts. These root-level modules are completely dead code — no external consumer imports them — but their presence creates confusion risk and architectural drift. Remove them and their tests to establish one unambiguous plan entity/storage path.

## Mode

`Direct requirements`

The problem is fully mapped: three dead-code modules, their corresponding dead tests, and zero external consumers. No design ambiguity remains.

## Must-Have Requirements

- **R1:** Delete root-level `plan-store.ts` (`extensions/megapowers/plan-store.ts`)
- **R2:** Delete root-level `entity-parser.ts` (`extensions/megapowers/entity-parser.ts`)
- **R3:** Delete root-level `plan-schemas.ts` (`extensions/megapowers/plan-schemas.ts`)
- **R4:** Delete corresponding test files for the root-level modules (`tests/plan-store.test.ts`, `tests/entity-parser.test.ts`, `tests/plan-schemas.test.ts`)
- **R5:** Verify no remaining import references to the deleted root-level modules exist anywhere in the codebase
- **R6:** All existing tests pass after removal (no regressions)

## Optional / Nice-to-Have

None.

## Explicitly Deferred

- **D1:** Unifying the runtime `PlanTask` type in `state-machine.ts` (`index`/`description`/`completed`) with the storage `PlanTask` schema in `state/plan-schemas.ts` (`id`/`title`/`status`) — different problem (runtime vs storage representation), separate issue if warranted
- **D2:** Refactoring the conversion layer in `derived.ts` that bridges schema ↔ state-machine `PlanTask` formats

## Constraints

- **C1:** The `state/` versions (`state/plan-store.ts`, `state/entity-parser.ts`, `state/plan-schemas.ts`) are the canonical path and must not be modified
- **C2:** No behavioral changes — this is pure dead code removal
- **C3:** Existing tests for the `state/` modules and all other test suites must continue to pass

## Open Questions

None.

## Recommended Direction

This is a straightforward dead code removal. The three root-level modules (`plan-store.ts`, `entity-parser.ts`, `plan-schemas.ts`) and their tests form a self-contained cluster with no external consumers. They can be deleted in one pass.

Before deletion, a final verification sweep should confirm no imports reference the root-level paths (the exploration already confirmed this, but the implementation should re-verify). After deletion, running the full test suite confirms no regressions.

This is the simplest possible structural hardening win — removing code that exists only to confuse.

## Testing Implications

- The primary verification is that the full test suite (`bun test`) passes after deletion with no failures
- A grep/import scan confirms no remaining references to the deleted module paths
- No new tests are needed — this is pure removal
