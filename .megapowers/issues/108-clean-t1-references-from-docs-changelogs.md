---
id: 108
type: bugfix
status: done
created: 2026-03-07T14:57:33.666Z
sources: [94, 95]
milestone: M3
priority: 2
---
# Clean T1 references from docs, changelogs, and plan-review guidance
## Problem

After removing T1 and reshaping plan review, the docs will still describe a two-tier validation model and may continue to overstate what pre-checks guarantee.

## Scope

Clean or update references to T1 model lint across docs and user-facing guidance.

Likely files include:
- `README.md`
- `CHANGELOG.md`
- `.megapowers/CHANGELOG.md`
- plan/review docs under `.megapowers/docs/`

## Acceptance criteria

1. User-facing docs no longer describe T1 as part of the active plan transition flow.
2. Docs consistently describe T0 as the only built-in pre-submit validation layer.
3. Any new subagent-assisted planning guidance is clearly framed as advisory/experimental, not a hidden gate.
4. Historical shipped docs can stay as historical artifacts, but active guidance should be corrected.
