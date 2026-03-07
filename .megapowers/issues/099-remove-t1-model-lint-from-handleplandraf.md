---
id: 99
type: bugfix
status: open
created: 2026-03-07T14:56:48.751Z
sources: [94]
milestone: M3
priority: 1
---
# Remove T1 model lint from handlePlanDraftDone in extensions/megapowers/tools/tool-signal.ts
## Problem

`handlePlanDraftDone()` currently performs a model-based T1 lint before switching to review mode. This adds nondeterminism, fail-open behavior, and a hidden pre-review gate that worsens review quality.

## Scope

Simplify `extensions/megapowers/tools/tool-signal.ts` so `handlePlanDraftDone()` only:
- validates phase/plan mode
- verifies task files exist
- transitions `planMode` to `review`
- requests a new session

## Acceptance criteria

1. `handlePlanDraftDone()` no longer calls `lintPlanWithModel()` or any `completeFn`.
2. T1 warning/error message plumbing is removed from the function.
3. Imports that only supported T1 are removed from `tool-signal.ts`.
4. Existing non-T1 transition behavior remains intact (wrong phase/mode, no tasks, successful transition).
