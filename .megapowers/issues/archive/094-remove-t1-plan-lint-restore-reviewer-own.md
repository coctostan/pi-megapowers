---
id: 94
type: feature
status: closed
created: 2026-03-07T14:25:36.150Z
milestone: M3
priority: 1
---
# Remove T1 plan lint, restore reviewer ownership, and reduce plan-phase context overload
## Problem

The new T1 model lint in `plan_draft_done` made plan review worse.

Current problems:
- `plan_draft_done` now performs a hidden fast-model lint before entering review
- T1 is fail-open on API errors / malformed responses, but the reviewer prompt still assumes that basic issues were already caught
- the reviewer prompt was narrowed too aggressively, which creates false confidence and causes missed plan problems
- plan drafting/review/revise is also suffering from context overload: a single session is expected to hold the full spec, all tasks, prior review feedback, and repo details at once

T0 deterministic validation in `megapowers_plan_task` is still useful and should remain.

## Goal

Simplify ownership again:
- T0 stays as the inline deterministic guardrail
- the deep reviewer fully owns plan quality
- remove T1 model lint from the review transition
- improve prompts so planner/reviewer/reviser handle large plans more reliably
- evaluate whether `pi-subagents` is a better fit for plan/review/revise context decomposition than for implementation

## Proposed direction

### 1. Roll back T1
- remove model lint from `plan_draft_done`
- remove fail-open warning/pass behavior tied to T1
- remove prompt language that tells the reviewer to assume coverage/dependency/mechanical issues were already verified

### 2. Prompt improvements before / alongside rollback
- tighten `write-plan.md`, `review-plan.md`, and `revise-plan.md`
- explicitly tell the reviewer to treat any pre-check as advisory, not authoritative
- reduce firehose behavior by structuring reading order and encouraging chunked task review rather than one giant context blob
- strengthen revise instructions so the reviser focuses only on changed tasks without losing global coverage/dependency awareness

### 3. Evaluate subagents for plan/review/revise
Investigate using `pi-subagents` for context decomposition instead of implementation delegation. The extension appears better suited for:
- a `scout` / `context-builder` pass that reads the repo and produces compact `context.md`
- a `planner` pass that drafts tasks from `spec + context`
- targeted parallel review passes (for example: coverage reviewer, dependency reviewer, task-quality reviewer) whose outputs are synthesized by the main reviewer
- bounded artifacts (`context.md`, `plan.md`, `review.md`, `revise-instructions.md`) instead of one overloaded session carrying everything in memory

Do **not** reintroduce implementation pipelines/worktrees here. The investigation is specifically about using subagents to reduce plan-phase context overload and improve review quality.

## Acceptance criteria

1. `plan_draft_done` no longer calls a model-based lint step before entering review mode.
2. `extensions/megapowers/register-tools.ts` no longer wires a T1 lint completion function for `plan_draft_done`.
3. T1-only files/tests are removed or replaced.
4. `prompts/review-plan.md` no longer assumes mechanical/spec/dependency issues were already caught by T1.
5. Plan prompts are updated to reduce context overload and make reading/review order more explicit.
6. A short design note or experiment artifact documents whether `pi-subagents` should be used for plan/review/revise, including at least one concrete recommended chain/parallel pattern and one explicit non-goal.
7. Existing T0 deterministic task validation remains intact.

## Notes

`pi-subagents` seems promising here because it provides:
- project/user agents
- reusable chains
- parallel fan-out/fan-in
- artifact files like `context.md` / `plan.md`
- clarify UI and management actions

That fits plan/review/revise much better than code implementation, where delegation quality and squash/ownership become much messier.
