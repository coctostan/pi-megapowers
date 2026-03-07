---
id: 96
type: bugfix
status: open
created: 2026-03-07T14:56:48.745Z
sources: [94]
milestone: M3
priority: 1
---
# Restore full reviewer ownership in prompts/review-plan.md
## Problem

`prompts/review-plan.md` now tells the reviewer that T0/T1 already caught mechanical issues and that they should focus only on higher-order concerns. In practice, T0 does not guarantee all of those properties, and T1 is unreliable. This prompt change creates false confidence and causes the reviewer to skip checks they still need to perform.

## Scope

Update `prompts/review-plan.md` so the reviewer:
- treats any earlier validation as advisory, not authoritative
- re-checks coverage, dependencies, TDD completeness, self-containment, and codebase realism
- reviews tasks in a more structured order instead of assuming fundamentals are handled

## Acceptance criteria

1. `prompts/review-plan.md` no longer says that T1/model lint already verified coverage/dependency/mechanical issues.
2. The prompt explicitly states that deterministic checks are only hints and the reviewer still owns the full review verdict.
3. The prompt keeps the existing structured per-task review output and revise-instructions handoff requirements.
4. Prompt tests are updated if needed to reflect the new wording.
