# Milestones

> Operational tracking for milestone → issue mapping and progress.
> Updated: 2026-03-01

---

## ✅ M0: Restructure — COMPLETE

All issues shipped: #070 (directory restructure), #043 (extract slash commands).

---

## M1: UX Foundation

**Status:** In progress (3 issues)
**Theme:** Fix the worst pain. A new user can start an issue and get through brainstorm → spec without getting stuck.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 061 | jj mismatch dialog frozen | 1 | open |
| 051 | UX feedback, visibility & transparency | 2 | open |
| 073 | /mp command hub & issue management UX | 2 | open |

**Notes:** #051 absorbs #042. #073 absorbs #058.

---

## ✅ M2: Subagent Pipeline — MOSTLY COMPLETE

Core pipeline shipped: #067 (workspace squash), #076 (per-task chain). One issue remains for polish:

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 074 | Subagent structured handoff & rich UI | 2 | open |

**Notes:** #074 absorbs #075. Pipeline-runner does implement→verify→review. This issue adds structured result format and user-facing display.

---

## ✅ M3: Plan/Review Loop — MOSTLY COMPLETE

Core loop shipped: #066 (iterative plan-review), #085 (wiring & API). One issue remains:

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 059 | Workflow iteration quality — context management | 2 | open |

---

## M4: VCS Integration

**Status:** Not started (1 issue)
**Theme:** Clean close. Issue goes from done → merged/pushed automatically.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 083 | Comprehensive VCS integration (git + jj) | 1 | open |

**Notes:** #083 absorbs #064. Covers bookmark management, squash-on-done, git push, PR creation, branch cleanup, session resume, git-only fallback.

---

## M5: TDD Flexibility + Issue Management

**Status:** Not started (2 issues)
**Theme:** Polish the dev workflow.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 068 | `[prompt-test]` task type | 2 | open |
| 077 | Issue priority, archiving, list UI | 3 | open |

---

## M6: Init System

**Status:** Not started (4 issues)
**Theme:** The second product. Init workflows + foundation doc lifecycle.
**Gate:** User runs `/mp init` on brownfield, walks through all phases, produces foundation docs.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 078 | Init workflow system | 1 | open |
| 079 | Foundation doc lifecycle | 2 | open |
| 080 | Clean context windows | 3 | open |
| 052 | Project lifecycle management | 3 | open |

**Notes:** #078 absorbs #081 (doc audit) and #082 (greenfield templates).

---

## Summary

| Milestone | Total | Done | Remaining |
|-----------|-------|------|-----------|
| M0 | 2 | 2 | 0 ✅ |
| M1 | 3 | 0 | 3 |
| M2 | 1 | 0 | 1 |
| M3 | 1 | 0 | 1 |
| M4 | 1 | 0 | 1 |
| M5 | 2 | 0 | 2 |
| M6 | 4 | 0 | 4 |
| **Total** | **14** | **2** | **12** |
