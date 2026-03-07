# Design: Plan Review Recovery + Subagent-Assisted Planning

**Primary issues:** #094, #095  
**Related rollout issues:** #096, #097, #098, #099, #100, #101, #102, #103, #104, #105, #106, #107, #108, #109  
**Date:** 2026-03-07  
**Status:** Proposed

## Problem Summary

Two separate problems are currently entangled:

1. **T1 made plan review worse.** `plan_draft_done` now performs a hidden model-based lint before entering review mode. The reviewer prompt was also narrowed to assume earlier checks already handled fundamentals. In practice this creates false confidence, fail-open behavior, and muddier ownership.
2. **The plan phase is overloaded.** One session is expected to hold the full spec/diagnosis, repo structure, task graph, prior review feedback, and revise instructions at once. Large plans become a firehose.

These need different responses:
- **Immediate recovery:** keep T0, remove T1, restore reviewer ownership.
- **Follow-on improvement:** use subagents to decompose planning context into bounded advisory artifacts.

## Goals

### Immediate
- Keep T0 deterministic validation in `megapowers_plan_task`
- Remove T1 model lint from `plan_draft_done`
- Restore full reviewer ownership of plan quality
- Improve plan/revise prompts to reduce context overload without hiding responsibility

### Follow-on
- Use `pi-subagents` to split planning work into bounded, read-heavy passes
- Keep all megapowers workflow authority in the main session
- Make planning artifacts explicit and inspectable instead of burying more logic in hidden gates

## Non-Goals

- No revival of implementation delegation / pipeline-style code writing
- No subagent-owned `megapowers_plan_review` calls
- No subagent-owned `plan_draft_done` calls
- No hidden model gate replacing T1 with a different name
- No requirement that every plan/review/revise flow use subagents

## Core Principles

1. **One authority, many advisors.** The main session owns task writes, review verdicts, and phase transitions. Subagents only produce advisory artifacts.
2. **Bounded artifacts beat giant context windows.** Context should be written to explicit markdown files (`context.md`, `coverage-review.md`, etc.) rather than carried implicitly in one large session.
3. **Decompose by concern.** Coverage, dependency analysis, and per-task quality are different review jobs and should not always compete in the same context window.
4. **Keep gates deterministic.** If something blocks a state transition, it should be deterministic and local. Advisory model output belongs in artifacts, not in hidden transition logic.

## Proposed Final Ownership Model

### Main session owns
- `megapowers_plan_task`
- `megapowers_plan_review`
- `megapowers_signal({ action: "plan_draft_done" })`
- Writing final `revise-instructions-N.md`
- Final synthesis and approve/revise decisions

### Subagents own
- Repo scouting
- Acceptance-criteria mapping
- Dependency/order analysis
- Task-quality analysis
- Revision assistance proposals
- Writing bounded planning artifacts under the plan directory or chain directory

## Phase 1 — Immediate Recovery (Issue #094)

### Target behavior
`plan_draft_done` should return to being a simple transition:
1. validate phase / mode
2. ensure task files exist
3. switch `planMode` to `review`
4. request a new session

### Prompt posture after rollback
- `write-plan.md` should help the planner manage the firehose with staged drafting and explicit self-audits
- `review-plan.md` should treat any pre-check as advisory only and restore full reviewer ownership
- `revise-plan.md` should stay narrow on changed tasks but still require a final global sanity pass

### Why this order matters
If subagent-assisted planning is introduced before reviewer ownership is restored, the system will just accumulate more hidden authority. The rollback must happen first.

## Phase 2 — Subagent-Assisted Plan/Review/Revise (Issue #095)

## V1 project-scoped scout rollout

For the first rollout, use the project agent `.pi/agents/plan-scout.md` through the external `pi-subagents` extension rather than adding new megapowers runtime orchestration.

For v1, `plan-scout` writes `.megapowers/plans/<issue-slug>/context.md` at the plan directory root.

`context.md` is a planning handoff consumed by the main planning session. It is advisory only and is not canonical workflow state.

The main planning session reads `context.md`, verifies details as needed, and remains responsible for `megapowers_plan_task`, `megapowers_plan_review`, and `megapowers_signal({ action: "plan_draft_done" })`.

## Draft Assist

### Goal
Separate repo discovery from task authoring.

### Recommended pattern
`plan-scout` runs first and writes a compact `context.md` that the main planning session consumes while creating real task files.

### Inputs
- spec/diagnosis
- roadmap context if relevant
- targeted repo reads

### Output
`context.md` with:
- AC/fixed-when mapping to files and symbols
- key file list with exact paths
- existing APIs and test conventions
- sequencing risks / likely task boundaries

### Why
This turns “read the whole repo while drafting” into “read a bounded scout artifact, then verify details as needed.”

## Review Assist

### Goal
Decompose review by concern rather than by one overloaded reviewer pass.

### Recommended parallel fan-out
- `coverage-reviewer` → writes `coverage-review.md`
- `dependency-reviewer` → writes `dependency-review.md`
- `task-quality-reviewer` → writes `task-quality-review.md`

### Fan-in
The main review session reads those artifacts plus task files and produces:
- the final verdict
- the official `megapowers_plan_review(...)` call
- `revise-instructions-N.md` if needed

### Why
This avoids forcing one context window to simultaneously reason about AC coverage, graph correctness, and per-task realism.

## Revise Assist

### Goal
Make revise sessions targeted instead of full-plan reloads.

### Recommended pattern
`revise-helper` reads:
- latest `revise-instructions-N.md`
- only affected task files
- optional compact coverage/dependency summaries

It writes `revise-proposal.md` containing:
- task-local fixes
- replacement snippets or exact section rewrites
- short global sanity check (coverage/dependency fallout)

The main session then applies actual edits and resubmits.

## Artifact Layout
For the v1 scout rollout, the draft handoff lives at the plan root as `.megapowers/plans/<issue-slug>/context.md`. The `subagents/draft/` layout below is reserved for future expanded chains.

Recommended layout under the active plan directory:

```text
.megapowers/plans/<issue-slug>/
  subagents/
    draft/
      context.md
      coverage-map.md
    review/
      coverage-review.md
      dependency-review.md
      task-quality-review.md
      synthesis-notes.md
    revise/
      revise-proposal.md
```

Rules:
- Artifacts are advisory, never canonical state
- Canonical tasks still live in `tasks/task-NNN.md`
- Canonical review result still comes from `megapowers_plan_review`

## Proposed Project Agents

### `plan-scout`
Purpose: bounded repo context for planning.

### `coverage-reviewer`
Purpose: AC/fixed-when coverage only.

### `dependency-reviewer`
Purpose: ordering, hidden prerequisites, forward references, unnecessary dependencies.

### `task-quality-reviewer`
Purpose: self-containment, TDD completeness, concrete commands/errors/API realism.

### `revise-helper`
Purpose: propose targeted revisions for only the affected tasks.

## Recommended Reusable Workflows

### Draft-assist chain
Minimal chain:

```text
plan-scout -> planner
```

Operational meaning:
- `plan-scout` produces `context.md`
- `planner` or the main session turns that into task drafts
- final `megapowers_plan_task` calls remain in the main session

### Review-fanout pattern
Recommended parallel pattern:

```text
coverage-reviewer
dependency-reviewer
task-quality-reviewer
```

Outputs are synthesized by the main review session.

### Revise-assist pattern
Single focused helper:

```text
revise-helper
```

## Risks and Mitigations

### Risk: advisory artifacts become hidden authority
**Mitigation:** prompts must explicitly state that subagents do not own verdicts or transitions.

### Risk: artifact sprawl becomes the new firehose
**Mitigation:** fixed artifact names, bounded formats, and concern-specific outputs only.

### Risk: review gets slower instead of sharper
**Mitigation:** start with optional draft-assist / review-fanout experiments, not mandatory orchestration.

### Risk: planning subagents accidentally drift into implementation delegation
**Mitigation:** make implementation delegation an explicit non-goal in prompts, docs, and issue scope.

## Success Criteria for the Experiment

We should consider the subagent-assisted planning experiment successful if it produces most of the following:

1. Less context overload in the main planning/review sessions
2. More precise and less repetitive revise instructions
3. Fewer revise rounds caused by missed coverage/dependency/task-quality issues
4. Better inspectability via bounded artifacts rather than hidden model gates
5. Clear ownership: humans/main session still know who decides what

We should consider it a failure if we see any of the following:

1. Subagents effectively become hidden approvers/rejecters
2. Planning requires reading more artifacts than before without better outcomes
3. Agents start behaving like code-writing pipelines again
4. The new flow is too cumbersome to use on medium-sized issues

## Granular Rollout Issue Map

## Immediate recovery / prompt fixes
- **#096** — Restore full reviewer ownership in `prompts/review-plan.md`
- **#097** — Reduce plan drafting firehose in `prompts/write-plan.md`
- **#098** — Tighten `prompts/revise-plan.md` for narrow revisions + global sanity pass
- **#099** — Remove T1 model lint from `tool-signal.ts`
- **#100** — Remove T1 model wiring from `register-tools.ts`
- **#101** — Delete T1 module/prompt/tests and simplify transition coverage
- **#108** — Clean T1 references from docs/changelogs/guidance

## Subagent-assisted planning foundation
- **#102** — Add `plan-scout` agent
- **#103** — Add `coverage-reviewer` agent
- **#104** — Add `dependency-reviewer` agent
- **#105** — Add `task-quality-reviewer` agent
- **#106** — Add `revise-helper` agent
- **#107** — Add project chain definitions for draft-assist and review-fanout
- **#109** — Write experiment notes and success criteria for subagent-assisted planning

## Suggested implementation order

### Order A — restore correctness first
1. #096
2. #099
3. #100
4. #101
5. #108
6. #097
7. #098

### Order B — then prototype bounded planning helpers
8. #102
9. #103
10. #104
11. #105
12. #106
13. #107
14. #109

## Recommendation

Treat #094 as the immediate recovery track and #095 as the experimental improvement track.

In short:
- **Keep T0**
- **Kill T1**
- **Restore reviewer responsibility**
- **Use subagents only as bounded planning advisors, never as hidden authorities**
