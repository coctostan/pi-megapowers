# Subagent Planning Support Layer — Revise Helper, Draft Assist Chain, Review Fan-out Pattern

**Issue:** #115 (batch: #106, #107)  
**Type:** feature  
**Date:** 2026-03-06

## What Was Built

A thin, reusable planning-support layer consisting of three artifacts:

### 1. `revise-helper` agent (`.pi/agents/revise-helper.md`)

A project-scoped advisory agent for targeted plan revision. Addresses the recurring problem where revise sessions either reload the entire plan (expensive) or produce shallow fixes that don't address the root issue.

**Design decisions:**
- Reads only the latest `revise-instructions-N.md` and only the affected task files — not the full plan.
- Guards against reading prior review artifacts unless the revise instructions explicitly reference them.
- Produces a single bounded artifact (`revise-proposal.md`) with a structured format: task-local fixes (exact replacement snippets) + a short global sanity check for coverage/dependency fallout.
- Explicitly advisory: does not call `megapowers_plan_task`, `megapowers_plan_review`, or `megapowers_signal`. The main session performs all canonical task edits and resubmission.

### 2. `draft-assist` chain (`.pi/agents/draft-assist.chain.md`)

A project-scoped sequential chain that encodes the `plan-scout → planner` draft-assist workflow.

**Design decisions:**
- Two steps: `plan-scout` (produces `context.md` handoff) → `planner` (reads `context.md`, produces advisory draft).
- Uses the bounded artifact name `context.md` consistently — same name used by the existing standalone `plan-scout.md` agent.
- `planner` runs with `model: anthropic/claude-sonnet-4-5:high` and `progress: true` for quality and live feedback.
- All megapowers tool calls remain in the main session. Neither step creates canonical task files.
- Companion `planner.md` agent created (`.pi/agents/planner.md`) — required because the pi-subagents chain runner resolves step names to agent files by exact name match.

### 3. Review fan-out pattern doc (`.megapowers/docs/115-review-fanout-pattern.md`)

Documents the reusable parallel review fan-out pattern for the three focused reviewers (`coverage-reviewer`, `dependency-reviewer`, `task-quality-reviewer`) without pretending that saved markdown chains support parallel fan-out yet.

**Design decisions:**
- Documents inputs (spec/diagnosis + task files), bounded output artifact names (`coverage-review.md`, `dependency-review.md`, `task-quality-review.md`), and main-session synthesis responsibility.
- Explicit Non-goals section guards against scope creep (no new runtime orchestration, no parallel chain support, no delegation of final review authority).

## Why

Revise sessions and draft sessions were context-heavy and inconsistently scoped. Without a defined agent, every revise session either loaded the full plan or made ad-hoc decisions about what to read. The revise-helper enforces a narrow, input-driven scope. The draft-assist chain makes the `plan-scout → planner` workflow reusable and discoverable rather than requiring per-session manual orchestration.

## What Was Not Changed

- No megapowers runtime orchestration was added.
- No changes to `pi-subagents` chain execution.
- The existing focused review runtime (`focused-review-runner.ts`, `focused-review.ts`) is unchanged.
- Subagents still cannot edit canonical task state or own workflow transitions.

## Files Created

| File | Purpose |
|------|---------|
| `.pi/agents/revise-helper.md` | Advisory revise-helper agent |
| `.pi/agents/draft-assist.chain.md` | Sequential draft-assist chain (plan-scout → planner) |
| `.pi/agents/planner.md` | Advisory planner agent (required by chain runner) |
| `.megapowers/docs/115-review-fanout-pattern.md` | Review fan-out pattern documentation |
| `.megapowers/docs/115-subagent-plan-revision-workflows-revise-.md` | This document |
