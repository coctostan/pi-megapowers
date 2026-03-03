---
id: 90
type: bugfix
status: done
created: 2026-03-02T17:39:51.921Z
sources: [88, 89]
---

# Plan review bypass and task derivation failures

Two related bugs: (1) phase_next during plan phase bypasses the plan review gate entirely — no planMode or review approval check exists on the plan→implement transition in either workflow. (2) deriveTasks only reads legacy plan.md format, ignoring the new task files in tasks/ — when the approve path is bypassed (#088), generateLegacyPlanMd never runs, so implement phase finds 0 tasks. Includes a prompt audit to ensure plan-phase templates align with the runtime enforcement.
