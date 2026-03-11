---
id: 95
type: feature
status: closed
created: 2026-03-07T14:52:14.775Z
milestone: M3
priority: 2
---
# Use subagents to decompose plan/review/revise context instead of implementation
## Problem

The plan phase is overloaded: one session is expected to hold the full spec/diagnosis, codebase context, task set, review findings, and revise instructions at once. This contributes to shallow plans, noisy reviews, and revision loops that lose precision.

At the same time, the installed `pi-subagents` extension is much better suited to read-heavy, artifact-oriented work than to code implementation. It supports:
- project-scoped custom agents in `.pi/agents/`
- chains and parallel fan-out/fan-in
- bounded artifact handoff (`context.md`, `plan.md`, review notes, etc.)
- clarify UI and reusable chain definitions

Megapowers should explore using subagents to **decompose context during plan/review/revise**, while keeping final plan-task writes and plan-review verdicts in the main session.

## Goal

Design and prototype a subagent-assisted plan workflow where subagents produce advisory artifacts and focused analyses, but do **not** own workflow state transitions.

## Proposed direction

### Core principle
Subagents are helpers, not authorities.

They may:
- read the repo/spec/tasks
- produce context and analysis artifacts
- fan out review concerns into separate passes
- propose edits or findings

They must **not** directly:
- call `megapowers_plan_review`
- call `megapowers_signal({ action: "plan_draft_done" })`
- mutate state files
- own implementation/code-writing workflows

### Candidate flow

#### Draft assist
1. `plan-scout` reads spec + repo and writes compact `context.md`
2. optional `plan-coverage-map` writes AC→files / AC→task suggestions
3. main session drafts actual task files via `megapowers_plan_task`

#### Review assist
1. subagents fan out into focused passes, e.g.
   - coverage reviewer
   - dependency reviewer
   - task-quality reviewer
2. each writes a bounded artifact with findings
3. main reviewer session synthesizes findings and decides approve/revise
4. main session writes `revise-instructions-N.md` and calls `megapowers_plan_review`

#### Revise assist
1. `revise-helper` reads latest reviewer instructions + affected tasks only
2. outputs proposed task-body edits / gap checklist
3. main session applies edits and resubmits

## Acceptance criteria

1. A design note documents at least one recommended chain for draft assist and one recommended parallel pattern for review assist.
2. The design explicitly states that subagents are advisory only and the main session retains ownership of `megapowers_plan_task`, `megapowers_plan_review`, and `plan_draft_done`.
3. At least 3 project agent definitions are proposed or prototyped under `.pi/agents/` for planning use cases (e.g. `plan-scout`, `plan-reviewer`, `revise-helper`).
4. The design includes concrete artifact names/locations for subagent outputs so context stays bounded and inspectable.
5. The design includes at least one explicit non-goal: no implementation delegation / no pipeline-style code writing revival.
6. The experiment notes compare benefits and risks versus the current single-session planning flow.

## Notes

This should complement issue #094, not block it. We can improve prompts and remove T1 immediately while separately testing whether subagents reduce plan-phase firehose/context overload.
