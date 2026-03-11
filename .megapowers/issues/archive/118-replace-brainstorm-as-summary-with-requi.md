---
id: 118
type: feature
status: closed
created: 2026-03-09T02:06:05.780Z
milestone: M3
priority: 1
---
# Replace brainstorm-as-summary with requirements gathering and traceable spec distillation
The current feature flow treats `brainstorm` as a freeform exploratory phase whose output (`brainstorm.md`) is later 'converted' into `spec.md`. In practice, this allows requirements discussed live with the user to be compressed, reframed, or silently dropped before they ever become acceptance criteria. Recent audit of `.megapowers/plans/*` shows that spec→plan is usually faithful once something is in the spec, but brainstorm artifacts are not acting as a requirements ledger.

We should reframe the early feature workflow around **requirements gathering**, with brainstorming as an optional discovery mode rather than the canonical artifact.

## Proposed workflow framing

Instead of:
- brainstorm → spec → plan → implement → verify → code-review → done

Move toward:
- discovery (optional brainstorm) → requirements → spec → plan → implement → verify → code-review → done

Or, if we want to minimize workflow-phase churn in v1:
- Keep the existing `brainstorm` phase name externally, but change its purpose and prompt so its artifact behaves like a **requirements-gathering artifact**, not a design summary.

## Core problem to solve

A user can clearly state a must-have behavior during early discussion, but unless it survives the freeform brainstorm summary and is explicitly restated as acceptance criteria, it disappears by planning. We need traceability from early discussion to requirements to spec.

## Acceptance criteria

1. The early feature-phase prompt no longer treats the saved artifact as a freeform brainstorm summary; it requires a structured requirements-gathering output.
2. The early-phase artifact includes explicit sections for at least: `Must-Have Requirements`, `Optional / Nice-to-Have`, `Explicitly Deferred`, and `Open Questions`.
3. The early-phase artifact preserves concrete user-stated behaviors as individual requirement items rather than only folding them into prose.
4. The spec-writing prompt no longer says only 'convert brainstorm into spec'; it requires mapping each must-have requirement from the prior artifact into exactly one of: acceptance criteria, out of scope, or open question.
5. The spec-writing prompt requires a traceability section that shows requirement-to-spec mapping (for example: `R3 -> AC 4, 5` or `R7 -> Out of Scope`).
6. The feature workflow can support both exploratory discovery and direct requirements capture without losing the converged requirements artifact.
7. Prompt/test coverage verifies that requirement items cannot be silently omitted during the spec phase without being explicitly deferred or scoped out.
8. Documentation explains the new framing: brainstorming is optional discovery; requirements gathering is the canonical end state of the first stage.
9. Existing plan-writing and plan-review guidance continues to treat the spec as the execution contract, but now benefits from explicit requirement traceability.

## Notes from audit

- #077 suggests a live user requirement ('tab through to open/close/done issues') was absent from the saved `brainstorm.md`, meaning loss happened before spec/plan.
- #091, #113, #114, #115, #116 show that once requirements are explicit in spec/diagnosis, planning is usually faithful.
- Therefore the highest-leverage fix is the brainstorm/requirements/spec boundary, not just plan coverage.

## Likely files

- `prompts/brainstorm.md` (or replacement prompt)
- `prompts/write-spec.md`
- `extensions/megapowers/workflows/feature.ts` (if phase framing or guidance changes)
- tests covering prompt content / transition expectations
- docs explaining the new model
