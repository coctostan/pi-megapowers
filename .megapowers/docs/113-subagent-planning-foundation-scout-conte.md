# Feature: Subagent Planning Foundation — Plan Scout + Experiment Boundaries

**Issues:** #102, #109 (batch #113)  
**Date:** 2026-03-07  
**Status:** Shipped

## What was built

Three changes that together establish the foundation for subagent-assisted planning:

### 1. Project-scoped `plan-scout` agent (`.pi/agents/plan-scout.md`)

A new agent definition for use with the external `pi-subagents` extension. Before a planning session starts drafting tasks, the user can run `plan-scout` to produce a compact `context.md` handoff that maps acceptance criteria to files, surfaces existing APIs and conventions, and suggests task slices — without touching megapowers workflow state.

Key design decisions:
- **Fail-closed on missing planning artifact.** The scout stops and reports rather than falling back to a repo-only summary, preventing a content-free `context.md` from silently poisoning the planner's context.
- **Advisory-only authority.** Every megapowers write tool is explicitly named and forbidden: `megapowers_plan_task`, `megapowers_plan_review`, `megapowers_signal`. The plan-review authority ("do not approve or reject the plan") is also spelled out. Listing by name closes the loophole of vague "don't use megapowers tools" rules.
- **Bounded seven-section output contract.** The output is a numbered checklist (`Planning Input Summary`, `Acceptance Criteria / Fixed When → Files`, `Key Files`, `Existing APIs, Tests, and Conventions`, `Risks and Unknowns`, `Suggested Task Slices`, `Notes for the Main Planner`) rather than open-ended prose. This keeps the artifact compact and scannable by the main planning session.
- **Tool set is minimal.** `read, write, bash, grep, find, ls` — no `edit` (scout creates `context.md` fresh each run, never patches it).

### 2. V1 rollout documentation (`.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`)

Added a `## V1 project-scoped scout rollout` section that:
- Specifies the `pi-subagents` extension as the delivery mechanism (no new megapowers runtime required for v1)
- Explicitly states `context.md` is a planning handoff, advisory only, not canonical workflow state
- Names the main session as the sole authority for `megapowers_plan_task`, `megapowers_plan_review`, and `megapowers_signal({ action: "plan_draft_done" })`

Added a scoping sentence to `## Artifact Layout` that reconciles the v1 root-level `context.md` path with the pre-existing `subagents/draft/context.md` layout in the same document, preventing reader confusion.

### 3. Implement-prompt clarification (`prompts/implement-task.md`)

The old blanket "They are broken and will produce garbage code" wording contradicted the new advisory planning-scout workflow. Replaced with:

> **Do NOT use `pipeline` or `subagent` tools for implementation work in this session.** Do all implementation work inline here.
> 
> This restriction is specific to implement-phase task execution. Advisory planning-scout usage in the plan phase is separate.

The existing test at `tests/prompts.test.ts:312` continues to pass (regex `do not use.*pipeline` still matches the new wording).

## Why

Planning sessions are overloaded because repo discovery and task authoring happen in the same context window. A separate scout pass separates concerns: read-heavy scouting produces a bounded artifact, and the main session consumes that artifact rather than doing raw repo discovery inline.

The design doc already contained the `plan-scout -> planner` draft-assist chain and the `coverage-reviewer / dependency-reviewer / task-quality-reviewer` review-fanout pattern. The V1 rollout section grounds those patterns in a concrete first delivery mechanism (project agent + external extension) rather than leaving them as aspirational proposals.

## Files changed

| File | Change |
|------|--------|
| `.pi/agents/plan-scout.md` | **Created** — 52-line agent definition |
| `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` | **Modified** — V1 rollout section (+10 lines), artifact layout scoping (+1 line) |
| `prompts/implement-task.md` | **Modified** — Execution Mode wording narrowed (+3/-1 lines) |

## Test results

893 pass, 0 fail across 83 files. No regressions.
