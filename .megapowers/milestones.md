# Milestones

> Operational tracking for milestone → issue mapping and progress.
> Updated: 2026-03-03

---

## ✅ M0: Restructure — COMPLETE

All issues shipped: #070 (directory restructure), #043 (extract slash commands).

---

## M1: UX Foundation

**Status:** In progress (2 issues remaining)
**Theme:** Fix the worst pain. A new user can start an issue and get through brainstorm → spec without getting stuck.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| ~~061~~ | ~~jj mismatch dialog frozen~~ | ~~1~~ | ✅ done |
| 051 | UX feedback, visibility & transparency | 2 | open |
| ~~073~~ | ~~/mp command hub & issue management UX~~ | ~~2~~ | ✅ done |
| 087 | push-and-pr done action fails when not on feature branch | 2 | open |

**Notes:** #051 absorbs #042. #073 absorbs #058. #061 resolved as part of jj removal (#091). #087 is a done-phase bugfix that blocks clean wrap-up.

---

## ✅ M2: Subagent Pipeline — COMPLETE

All issues shipped via batch #086: #085 (squash fix), #074 (TUI visibility panel with onProgress, renderCall/renderResult, live step tracking).

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| ~~085~~ | ~~Pipeline squash fails with existing files~~ | ~~1~~ | ✅ done |
| ~~074~~ | ~~Subagent structured handoff & rich UI~~ | ~~2~~ | ✅ done |

---

## M3: Plan/Review Loop

**Status:** In progress (2 issues remaining)
**Theme:** Improve plan iteration quality and context handoff between review cycles.

Core loop shipped: #066 (iterative plan-review), #085 (wiring & API). Bugs fixed: #088/#089 via batch #090.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| ~~082~~ | ~~Reviewer-authored revise-instructions handoff~~ | ~~1~~ | ✅ done |
| 059 | Workflow iteration quality — context management | 2 | open |
| 088 | Use individual task files instead of plan.md | 2 | open |

---

## ✅ M4: VCS Integration — COMPLETE

All issues shipped: #083 (comprehensive VCS integration), #091 (jj removal → git worktrees).

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| ~~083~~ | ~~Comprehensive VCS integration (git)~~ | ~~1~~ | ✅ done |
| ~~091~~ | ~~Remove jj dependency~~ | ~~1~~ | ✅ done |

**Notes:** #083 absorbs #064. #091 replaced jj with git worktrees for pipeline isolation.

---

## M5: TDD Flexibility + Issue Management

**Status:** Not started (3 issues)
**Theme:** Polish the dev workflow.

| ID  | Title | Priority | Status |
|-----|-------|----------|--------|
| 068 | `[prompt-test]` task type | 2 | open |
| 077 | Issue priority, archiving, list UI | 3 | open |
| 089 | Add Zod frontmatter schemas to phase artifact files | 3 | open |

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
| M1 | 4 | 2 | 2 |
| M2 | 2 | 2 | 0 ✅ |
| M3 | 3 | 1 | 2 |
| M4 | 2 | 2 | 0 ✅ |
| M5 | 3 | 0 | 3 |
| M6 | 4 | 0 | 4 |
| **Total** | **20** | **9** | **11** |
