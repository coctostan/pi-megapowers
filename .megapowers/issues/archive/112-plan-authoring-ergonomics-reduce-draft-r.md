---
id: 112
type: feature
status: closed
created: 2026-03-07T15:16:23.184Z
sources: [97, 98]
---
# Plan authoring ergonomics — reduce draft/revise firehose
Implements the prompt-ergonomics slice from the overall design in `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`. This batch improves `prompts/write-plan.md` and `prompts/revise-plan.md` so large plans are handled in smaller, staged chunks with explicit sanity passes, without changing workflow authority boundaries. Goal: reduce context overload separately from the T1 rollback.
