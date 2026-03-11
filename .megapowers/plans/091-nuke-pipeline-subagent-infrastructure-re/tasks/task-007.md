---
id: 7
title: Update public documentation to remove the legacy pipeline workflow
status: approved
depends_on:
  - 5
  - 6
no_test: true
files_to_modify:
  - README.md
  - AGENTS.md
  - ROADMAP.md
files_to_create: []
---

### Task 7: Update public documentation to remove the legacy pipeline workflow [no-test] [depends: 5, 6]

**Justification:** documentation-only change.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `ROADMAP.md`

**Step 1 — Make the change**
Update the public docs so they no longer advertise the removed legacy implement-phase pipeline/subagent workflow.

Required edits:
- In `README.md`, remove the `pipeline` and legacy `subagent` entries from the tool table, remove the isolated-worktree architecture bullets, update the directory layout so it no longer presents `subagent/` or `.megapowers/subagents/<id>/` as supported runtime structure, and rewrite any surviving `subagent` references so they clearly refer only to preserved newer `pi-subagents` usage where applicable.
- In `AGENTS.md`, remove the custom-tool bullets for `pipeline` and legacy `subagent`, remove the satellite-mode enforcement notes, and rewrite the key-concepts/known-issues sections so they describe direct primary-session implementation rather than a per-task pipeline.
- In `ROADMAP.md`, remove or reword completed/current milestone entries that still present the deleted pipeline/subagent architecture as current product behavior.

Do not remove mentions of `pi-subagents` where they refer to focused review or other preserved non-legacy capabilities.

**Step 2 — Verify**
Run: `grep -nEi '(^|[^a-z])pipeline([^a-z]|$)|satellite mode|isolated git worktree|\bsubagent(s)?\b' README.md AGENTS.md ROADMAP.md || true; bun test`
Expected: any remaining matches are only preserved `pi-subagents` references or historical context that clearly distinguishes the preserved functionality from the deleted legacy path; public docs no longer advertise the removed implement-phase pipeline / one-shot subagent workflow; and the full test suite passes.
