# Milestones

> Operational tracking for milestone → issue mapping and progress.
> Milestone definitions: `.megapowers/init/megapowers/05-roadmap.md`
> Updated: 2026-02-25

---

## M0: Restructure

**Status:** Not started
**Theme:** Make the codebase workable. No user-visible changes.
**Gate:** All 546 existing tests pass. No behavior change.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 070 | Directory restructure | 1 | open |
| 043 | Extract slash commands, expose as LLM tools | 2 | open |
| 071 | Generalize state machine / WorkflowConfig | 2 | open |

**Dependency chain:** 070 → 071 (config needs clean dirs). 043 independent.

---

## M1: UX Foundation

**Status:** In progress
**Theme:** Fix the worst pain. PRD priority #1.
**Gate:** A new user can start an issue and get through brainstorm → spec without getting stuck.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 061 | jj mismatch dialog frozen | 1 | **done** |
| 072 | Kill phase transition popup | 1 | open |
| 050 | Agent context & awareness | 1 | in-progress |
| 042 | Interactive UX transparency | 2 | open |
| 051 | UX feedback & visibility | 2 | in-progress |
| 073 | /mp command hub | 2 | open |
| 041 | save_artifact overwrite + versioning | 3 | open |
| 058 | Issue management UX | 3 | open |

**Dependency chain:** 043 → 073 (hub needs extracted commands). 072 related to 042, 051.

---

## M2: Subagent Pipeline

**Status:** Not started
**Theme:** Make delegation work. PRD priority #2.
**Gate:** A 3-task plan completes via sequential subagent delegation, results squashed back.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 067 | Subagent workspace squash missing | 1 | open |
| 074 | Subagent structured result handoff | 2 | open |
| 075 | Rich subagent UI | 3 | open |
| 076 | Per-task subagent chain | 4 | open |

**Dependency chain:** 067 → 074 → 075, 076 (squash first, then structured data, then UI and chains).

---

## M3: Plan/Review Loop

**Status:** Not started
**Theme:** Plans that actually work. PRD priority #4.
**Gate:** A plan goes through REJECT → fix → re-review and produces a better plan than single-shot.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 066 | Merge plan + review into iterative loop | 1 | open |
| 059 | Context management + plan-review versioning | 2 | open |

**Foldable gaps:** Interview step → #066. Autonomy checkpoints → #066.

---

## M4: Done Phase

**Status:** Not started
**Theme:** Clean close. PRD priority #3.
**Gate:** Issue goes from code-review → done → merged/pushed with one confirmation.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 065 | Done phase refactor | 1 | open |
| 064 | jj bookmark + git push workflow | 1 | open |
| 063 | Done-phase artifacts write to wrong files | 2 | open |

**Foldable gaps:** Confirmation widget → #065. Issue archival → #065.
**Note:** #063 likely superseded by #065 (same root cause). Consider closing when #065 is worked.

---

## M5: Backward Transitions + TDD Flexibility + Issue Management

**Status:** Not started
**Theme:** Polish the dev workflow. PRD priorities #5, #6, #7.
**Gate:** User can go backward, see cascade warnings, re-implement without stale state.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 069 | Backward phase transitions | 1 | open |
| 068 | [prompt-test] task type | 2 | open |
| 077 | Issue priority, archiving, list UI | 3 | open |

**Foldable gaps:** Cascade invalidation → #069. Backward warning dialog → #069.

---

## M6: Init System + Clean Context Windows

**Status:** Not started (foundation docs completed in init phases 0–6)
**Theme:** The second product. Init workflows + foundation doc lifecycle.
**Gate:** User runs /mp init on brownfield, walks through all phases, produces foundation docs, starts dev workflow referencing them.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| 081 | Foundation doc audit | 1 | open |
| 082 | Greenfield process templates | 1 | open |
| 078 | Init workflow system (configs + templates) | 1 | open |
| 079 | Foundation doc lifecycle (inject + update + audit) | 2 | open |
| 062 | Prompt/skill audit workflow (new workflow type) | 2 | open |
| 080 | Clean context windows | 3 | open |
| 052 | Project lifecycle management | 3 | open |

**Dependency chain:** 081 → 082 → 078 (audit templates, then greenfield variants, then build engine). 071 → 078 (init needs WorkflowConfig). 078 → 079 (docs need init system). 080 independent.
**Note:** #052 partially stale — source #011 superseded by #064, source #049 addressed by init phases 0–6.

---

## Summary

| Milestone | Issues | Status |
|-----------|--------|--------|
| M0 | 3 | Not started |
| M1 | 8 | In progress |
| M2 | 4 | Not started |
| M3 | 2 | Not started |
| M4 | 3 | Not started |
| M5 | 3 | Not started |
| M6 | 7 | Not started |
| **Total** | **30** | |

**6 foldable gaps** noted inline (will be absorbed into existing issues during planning).
