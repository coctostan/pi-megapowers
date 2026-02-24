# Feature: Agent Context and Awareness (#050)

## Summary
This change improves Megapowers usability in two high-friction areas: (1) agents now receive a useful Megapowers orientation prompt even when **no issue is active**, and (2) the write-policy now allows **safe/allowlisted** documentation/config/typings edits in *every* phase without weakening source-code restrictions or the implement-phase TDD guard.

It also adds explicit prompt guidance to prevent the agent getting stuck on type-only work by standardizing `[no-test]` annotations in plans and documenting `/tdd skip` as an escape hatch during implementation.

## Design Decisions
- **Three-tier prompt injection**: mega-off → null; mega-on + no issue → `base.md`; mega-on + active issue → protocol + phase prompt.
- **Standalone `base.md`**: intentionally duplicates protocol content for simplicity (one file load in the no-issue path).
- **Allowlist-first write policy**: `isAllowlisted()` checked before phase blocking/TDD, so safe files pass in all phases.
- **Prompt-level TDD mitigation**: `[no-test]` annotation + `/tdd skip` guidance rather than runtime type-checker detection.

## Files Changed
- `extensions/megapowers/prompt-inject.ts` — Three-tier injection logic
- `extensions/megapowers/write-policy.ts` — Allowlist-first check, bugfix phases added to blocking
- `prompts/base.md` — New no-issue orientation prompt
- `prompts/write-plan.md` — `[no-test]` guidance
- `prompts/implement-task.md` — Type-Only Tasks section with `/tdd skip`
- `tests/write-policy.test.ts` — Policy matrix tests
- `tests/base-prompt.test.ts` — Base prompt content tests
- `tests/prompt-content.test.ts` — AC8/AC9 prompt guidance tests
- `tests/prompt-inject.test.ts` — Three-tier injection tests
- `tests/prompt-templates.test.ts` — Template variable coverage tests
