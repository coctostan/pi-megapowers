## Goal

Remove the dead root-level plan infrastructure modules and their dead tests so the codebase has one unambiguous active path for plan entity and storage behavior, reducing architectural drift without changing runtime behavior.

## Acceptance Criteria

1. `extensions/megapowers/plan-store.ts` is deleted from the codebase.
2. `extensions/megapowers/entity-parser.ts` is deleted from the codebase.
3. `extensions/megapowers/plan-schemas.ts` is deleted from the codebase.
4. `tests/plan-store.test.ts` is deleted from the codebase.
5. `tests/entity-parser.test.ts` is deleted from the codebase.
6. `tests/plan-schemas.test.ts` is deleted from the codebase.
7. A repository-wide verification confirms there are no remaining import or require references to the deleted root-level modules anywhere in the codebase.
8. The canonical `state/` plan infrastructure remains the active path after cleanup, with no modifications required to preserve behavior.
9. The project test suite passes after the cleanup, demonstrating no regressions from removing the dead modules and tests.

## Out of Scope

- Unifying the runtime `PlanTask` type in `state-machine.ts` with the storage `PlanTask` schema in `state/plan-schemas.ts`
- Refactoring the conversion logic in `derived.ts` between runtime and storage task representations
- Changing behavior, APIs, file conventions, or semantics of the canonical `state/` plan infrastructure
- Adding replacement abstractions or broader plan-loop refactors beyond deleting dead duplicate modules and dead tests
- Any optional/nice-to-have expansion; none were selected for this issue

## Open Questions

None.

## Requirement Traceability

- `R1 -> AC 1`
- `R2 -> AC 2`
- `R3 -> AC 3`
- `R4 -> AC 4, AC 5, AC 6`
- `R5 -> AC 7`
- `R6 -> AC 9`
- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `C1 -> AC 8, Out of Scope`
- `C2 -> AC 8, Out of Scope`
- `C3 -> AC 9`
