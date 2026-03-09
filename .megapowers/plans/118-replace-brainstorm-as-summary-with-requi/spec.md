## Goal
Replace the brainstorm phase's prose-summary model with structured requirements capture, and make spec writing a traceable distillation of those requirements — so concrete user-stated behaviors, scope boundaries, and deferrals cannot be silently lost between phases.

## Acceptance Criteria

1. The `brainstorm.md` prompt instructs the agent to triage between `Exploratory` and `Direct requirements` modes early in the conversation.
2. The `brainstorm.md` prompt requires the saved artifact to use explicit requirement IDs: `R#` (must-have), `O#` (optional), `D#` (deferred), `C#` (constraint), `Q#` (open question).
3. The `brainstorm.md` prompt requires reduced-scope items to be preserved as `O#` or `D#` rather than silently dropped.
4. The `brainstorm.md` prompt defines exact artifact sections: Goal, Mode, Must-Have Requirements, Optional / Nice-to-Have, Explicitly Deferred, Constraints, Open Questions, Recommended Direction, Testing Implications.
5. The `write-spec.md` prompt requires a `Requirement Traceability` section mapping every `R#` to exactly one destination (Acceptance Criterion, Out of Scope, or Open Question).
6. The `write-spec.md` prompt requires a `No silent drops` rule: no `R#` may be omitted from traceability.
7. The `write-spec.md` prompt includes `O#`, `D#`, and `C#` items in traceability when they materially affect scope or implementation.
8. The `write-spec.md` prompt includes legacy handling: when the prior brainstorm artifact is unstructured/prose-heavy, the agent must extract implied requirements and confirm them with the user before writing the spec.
9. The `write-spec.md` prompt requires that reduced-scope items remain visible instead of disappearing.
10. Prompt tests lock in the brainstorm contract: mode triage (`Exploratory` / `Direct requirements`), required sections, `R/O/D/C/Q` ID buckets, and scope-preservation language.
11. Prompt tests lock in the spec contract: `No silent drops`, `Requirement Traceability`, `every R# must appear exactly once`, legacy handling, and reduced-scope visibility.
12. The external workflow phase name remains `brainstorm` — no rename.
13. README and CHANGELOG reflect the updated brainstorm/spec model.

## Out of Scope
- **D1** Renaming the `brainstorm` phase to `requirements` or `discovery`.
- **D2** Broader workflow UX changes beyond prompt/test/doc updates.
- **D3** Full end-to-end traceability graph (issue ↔ brainstorm ↔ spec ↔ AC ↔ tasks ↔ code).
- **O1** Richer examples/templates for high-quality R/O/D/C/Q output.
- **O2** Stricter lint-style requirement ID coverage checks.

## Open Questions
None. (Q1 resolved: optional/deferred/constraint items appear in traceability only when they materially affect scope, matching the shipped prompt language.)

## Requirement Traceability
- `R1 -> AC 3, AC 4` (artifact uses explicit requirements, not prose)
- `R2 -> AC 1` (mode triage)
- `R3 -> AC 3` (reduced-scope preserved as O#/D#)
- `R4 -> AC 2` (R/O/D/C/Q ID buckets)
- `R5 -> AC 5, AC 7` (spec traceability from brainstorm requirements)
- `R6 -> AC 5, AC 6` (every R# maps to exactly one destination)
- `R7 -> AC 12` (no phase rename)
- `R8 -> AC 10, AC 11` (prompt tests enforce contract)
- `R9 -> AC 8` (legacy unstructured artifact handling)
- `C1 -> AC 12` (keep brainstorm label)
- `C2 -> AC 13` (scope = prompt/test/doc only)
- `C3 -> Out of Scope (D3)`
- `C4 -> AC 8` (backward compat with legacy artifacts)
- `O1 -> Out of Scope`
- `O2 -> Out of Scope`
- `D1 -> Out of Scope`
- `D2 -> Out of Scope`
- `D3 -> Out of Scope`
