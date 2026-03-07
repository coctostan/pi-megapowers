---
id: 110
type: bugfix
status: in-progress
created: 2026-03-07T15:16:23.181Z
sources: [96, 99, 100]
---
# Plan review recovery — disable T1 authority
Implements the first recovery slice from the overall design in `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`. This batch removes T1 from the active plan-review decision path without doing broad cleanup yet: restore full reviewer ownership in `prompts/review-plan.md`, remove model lint from `handlePlanDraftDone`, and remove the T1 model wiring in `register-tools.ts`. Goal: stop the bad behavior first, in the smallest coherent runtime/prompt slice.
