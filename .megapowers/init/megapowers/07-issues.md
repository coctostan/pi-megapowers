# Phase 7: Issues — megapowers

> **Completed:** 2026-02-25

---

## Summary

Decomposed 7 roadmap milestones (M0–M6) into 28 issues. Started with 17 existing issues from prior triage, created 11 new issues to fill gaps.

## Deliverables

| Artifact | Location |
|----------|----------|
| Milestones tracking | `.megapowers/milestones.md` |
| New issues (070–080) | `.megapowers/issues/070-*.md` through `080-*.md` |
| Updated frontmatter | All 28 issues now have `milestone:` and `priority:` |

## By the Numbers

| Metric | Count |
|--------|-------|
| Existing issues mapped | 17 |
| Gaps identified | 23 |
| Gaps foldable into existing issues | 6 |
| Gaps needing new issues | 14 |
| New issues created (after batching) | 11 |
| Total active issues | 28 |

## Milestone Distribution

| Milestone | Issues | Key Issues |
|-----------|--------|------------|
| M0: Restructure | 3 | #070 dir restructure, #071 WorkflowConfig |
| M1: UX Foundation | 8 | #061 frozen dialog, #072 kill popup, #050 prompt quality |
| M2: Subagent Pipeline | 4 | #067 squash fix, #074 structured handoff |
| M3: Plan/Review Loop | 2 | #066 iterative loop |
| M4: Done Phase | 3 | #065 refactor, #064 VCS workflow |
| M5: Backward + TDD + Issues | 3 | #069 backward transitions, #077 issue management |
| M6: Init System | 5 | #078 init workflows, #079 doc lifecycle |

## Issues Flagged for Archival

- **#052** (project lifecycle management) — partially stale. Source #011 (branching) superseded by #064. Source #049 (onboarding) partially addressed by init phases 0–6. Source #018 (roadmap updating) still relevant but covered differently by #079.
- **#063** (done-phase artifacts wrong files) — likely superseded by #065 (same root cause, broader fix). Close when #065 is worked.

## Process Notes

- The milestones file was the key insight — proposed during the phase as the connective layer between roadmap and issues.
- Gap analysis revealed more missing work (23 gaps) than existing work (17 issues).
- M6 had the most gaps (6) — expected for the furthest-out milestone.
- Batching reduced 14 gap issues to 11 — M6 gaps batched most aggressively (6 → 3).
