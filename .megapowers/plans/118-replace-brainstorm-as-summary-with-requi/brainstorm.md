## Goal
The current brainstorm flow can compress or lose user-stated requirements between conversation, saved brainstorm output, and spec writing. This issue should make brainstorm a structured requirements-capture phase and make spec writing a traceable distillation step so concrete requirements, scope boundaries, and deferrals remain explicit and testable.

## Mode
`Direct requirements`

The desired outcome and scope are already clear from the issue and merged prompt changes: preserve requirements explicitly, avoid silent drops, and enforce traceability into spec. This is clarification/capture work, not open-ended ideation.

## Must-Have Requirements
1. **R1** The brainstorm phase must explicitly preserve concrete user-stated requirements rather than relying on prose summaries.
2. **R2** The brainstorm flow must triage early between `Exploratory` and `Direct requirements` modes.
3. **R3** Reduced-scope items must remain visible and be captured as optional (`O#`) or deferred (`D#`) instead of disappearing.
4. **R4** The brainstorm artifact must use explicit requirement buckets with IDs: `R#`, `O#`, `D#`, `C#`, `Q#`.
5. **R5** The spec-writing flow must preserve traceability from brainstorm requirements into spec outputs.
6. **R6** Every brainstorm must-have requirement (`R#`) must map in spec to exactly one destination: Acceptance Criterion, Out of Scope, or Open Question.
7. **R7** The first pass must keep the external workflow phase name `brainstorm` (no rename required).
8. **R8** Prompt tests must enforce the updated brainstorm/spec contract so regressions are caught.
9. **R9** Spec generation must handle older unstructured brainstorm artifacts by extracting implied requirements before writing spec.

## Optional / Nice-to-Have
1. **O1** Add richer examples/templates showing high-quality `R/O/D/C/Q` outputs for common issue types.
2. **O2** Add stricter lint-style checks for requirement ID coverage beyond current prompt tests.

## Explicitly Deferred
1. **D1** Renaming the `brainstorm` phase to `requirements` or `discovery`.
2. **D2** Broader workflow UX changes (for example, removing/reworking visible review-phase UX beyond this scope).
3. **D3** Full end-to-end trace graph across issue ↔ brainstorm ↔ spec ↔ AC ↔ tasks ↔ code.

## Constraints
1. **C1** Keep the outward phase label `brainstorm` for compatibility and to avoid workflow churn in this slice.
2. **C2** Scope this issue to prompt/test/doc contract changes plus artifact capture, not broader architecture changes.
3. **C3** Do not attempt full cross-artifact/code traceability in this issue.
4. **C4** Maintain backward compatibility with legacy brainstorm artifacts that are prose-heavy/unstructured.

## Open Questions
1. **Q1** In spec traceability, should optional/deferred items always be listed, or only when they materially affect scope/acceptance criteria?

## Recommended Direction
Treat `brainstorm.md` as a first-class requirements artifact rather than a narrative summary. The critical change is structural: each concrete user intent must be represented as a typed item (`R/O/D/C/Q`) with stable IDs. This prevents requirement loss when moving between phases.

Treat `spec.md` as a contract distillation step with explicit mapping, not reinterpretation. The key enforcement rule is “no silent drops”: every `R#` must map to a concrete spec destination so scope decisions are explicit and reviewable.

Keep this issue intentionally narrow. Preserve compatibility by retaining the `brainstorm` phase name and avoiding larger workflow/UI overhauls. Document deferred bigger ideas explicitly so they remain discoverable without inflating this implementation.

Use tests as contract locks. Prompt tests should assert required structure, traceability expectations, and legacy handling behavior so future prompt edits cannot regress requirement preservation.

## Testing Implications
- Validate brainstorm prompt output expectations include mode triage and explicit `R/O/D/C/Q` sections.
- Validate spec prompt expectations include no-silent-drop requirement mapping and traceability coverage for all `R#`.
- Validate legacy/unstructured brainstorm handling path is represented in prompt behavior/tests.
- Regression-test that deferred/optional/scope-boundary visibility is preserved when materially relevant.
- Confirm artifact content is suitable for plan-phase task derivation without re-discovering hidden requirements.
