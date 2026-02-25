# Megapowers Project Audit — 2026-02-24

Captured during prompt/skill audit (#062). Items beyond prompt scope that need architectural or code changes.

## Bugfix Workflow Gaps

### No diagnosis review
**Severity: High**

Feature workflow has spec → plan → **review**. Bugfix has diagnose → plan → review. The review only checks the plan structure, not the diagnosis accuracy. A wrong root cause produces a perfectly structured plan that fixes the wrong thing. The reviewer can't catch this because they're evaluating plan quality, not diagnosis correctness.

**Proposed fix:** Add a diagnosis review step — either a new phase or a mode within diagnose (similar to #066 plan/review iterative loop). A reviewer subagent could check:
- Does the evidence actually support the claimed root cause?
- Are there alternative explanations the diagnoser didn't consider?
- Does the trace from symptom to root cause have gaps?

**Related:** #066 (plan/review iterative loop) — same pattern, could use the same mode-switching architecture.

### Multi-cause bugs have no re-diagnosis path
**Severity: Medium**

The workflow assumes a single root cause. If verify fails because the fix only addressed one of several contributing factors, the developer needs to go back to diagnose. But backward transitions don't work (#069), and even with #069 fixed, going back to diagnose means re-doing the full investigation instead of building on the existing diagnosis.

**Proposed fix:** After #069 (backward transitions), add support for "incremental diagnosis" — append to the existing diagnosis rather than overwriting it. The verify failure evidence becomes input to the next diagnosis round.

---

## Done Phase

### Fully broken (filed as #065)
- `appendLearnings()` is dead code — never called
- Capture-learnings has no approval/save flow
- Artifact capture via message scraping is fragile (Rube Goldberg)
- Menu is one-action-then-exit
- No tracking of completed wrap-up actions
- Redundant menu options

---

## Version Control (jj + git)

### No bookmark/branch/push workflow (filed as #064)
- No bookmark created on issue start
- No root change tracked for full-tree squash
- No git push — work never reaches GitHub
- No session resume

### Subagent workspace squash missing (filed as #067)
- Subagent changes captured as diff but never squashed into main working copy
- `buildWorkspaceSquashArgs()` exists but has zero callers

---

## State Machine / Phase Transitions

### Backward transitions unreachable (filed as #069)
- State machine defines backward transitions but no tool or command triggers them
- `phase_next` always goes forward
- `/phase` command doesn't accept a target phase

### Plan/review should be iterative (filed as #066)
- Currently separate phases with full transitions
- No structured feedback passing from reviewer to planner
- Rejections cause full rewrites instead of targeted fixes

---

## Prompt/Skill System

### No TDD for prompts (filed as #068)
- `[prompt-test]` task type needed
- Subagent-based verification cycle: baseline → change → verify → regression
- Currently falls under `[no-test]` with no enforcement

### Artifact overwrite protection (existing #041)
- `writeFileSync` is unconditional — no versioning
- Implementation detail added: rename to `phase.v1.md` before overwrite

---

## Filed Issues Summary

| # | Title | Type | Status |
|---|-------|------|--------|
| 041 | Artifact overwrite protection | bugfix | open (updated with versioning detail) |
| 063 | Done phase artifacts write to wrong files | bugfix | open (superseded by #065) |
| 064 | jj bookmark + git push workflow | feature | open |
| 065 | Done phase refactor | feature | open |
| 066 | Plan/review iterative loop | feature | open |
| 067 | Subagent workspace squash missing | bugfix | open |
| 068 | Prompt-test task type | feature | open |
| 069 | Backward phase transitions | feature | open |

## Not Yet Filed

| Item | Reason |
|------|--------|
| Diagnosis review step | Needs design — could be a new phase, a mode, or part of #066 pattern |
| Multi-cause re-diagnosis | Depends on #069 + incremental diagnosis design |
