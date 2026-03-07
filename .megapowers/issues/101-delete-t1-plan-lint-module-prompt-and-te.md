---
id: 101
type: bugfix
status: open
created: 2026-03-07T14:57:10.133Z
sources: [94]
milestone: M3
priority: 1
---
# Delete T1 plan-lint module, prompt, and tests; replace with simple transition coverage
## Problem

The T1 implementation introduced extra files and tests that reinforce the bad model-lint design:
- `extensions/megapowers/validation/plan-lint-model.ts`
- `prompts/lint-plan-prompt.md`
- `tests/plan-lint-model.test.ts`
- T1-specific sections in `tests/tool-signal.test.ts`

## Scope

Remove T1-specific assets and simplify test coverage to the restored transition behavior.

## Acceptance criteria

1. `plan-lint-model.ts`, `lint-plan-prompt.md`, and `plan-lint-model.test.ts` are removed.
2. T1-specific tests in `tests/tool-signal.test.ts` are removed or replaced with non-model transition tests.
3. No remaining runtime imports reference the deleted T1 module/prompt.
4. Test coverage still exists for the key `plan_draft_done` paths: wrong phase/mode, missing tasks, successful transition.
