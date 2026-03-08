---
id: 115
type: feature
status: in-progress
created: 2026-03-07T15:18:22.110Z
sources: [106, 107]
---
# Subagent plan revision workflows — revise helper and reusable chains
Implements the targeted revision/orchestration slice from the overall design in `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`. This batch adds a revise-helper agent plus project chain definitions for draft assist and review fan-out. Goal: make planning workflows reusable and bounded without letting subagents own `megapowers_plan_task`, `megapowers_plan_review`, or `plan_draft_done`.
