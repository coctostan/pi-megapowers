---
id: 2
title: Document context.md handoff and planning-subagent experiment rules
status: approved
depends_on:
  - 1
no_test: true
files_to_modify:
  - .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
files_to_create: []
---

### Task 2: Document context.md handoff and planning-subagent experiment rules [no-test] [depends: 1]

**Justification:** documentation-only change — this task updates the planning design note and is best verified by checking for the required wording and running the existing test suite for regression safety.

**Covers:** AC6, AC7, AC8, AC9

**Files:**
- Modify: `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md`

**Step 1 — Make the change**
Update `.megapowers/docs/095-subagent-assisted-plan-review-decomposition.md` to add an explicit v1 rollout note for the project-scoped scout. Add a short subsection near the Draft Assist / Artifact Layout sections with wording equivalent to the block below:

```md
## V1 project-scoped scout rollout

For the first rollout, use the project agent `.pi/agents/plan-scout.md` through the external `pi-subagents` extension rather than adding new megapowers runtime orchestration.

For v1, `plan-scout` writes `.megapowers/plans/<issue-slug>/context.md` at the plan directory root.

`context.md` is a planning handoff consumed by the main planning session. It is advisory only and is not canonical workflow state.

The main planning session reads `context.md`, verifies details as needed, and remains responsible for `megapowers_plan_task`, `megapowers_plan_review`, and `megapowers_signal({ action: "plan_draft_done" })`.
```

Keep the existing draft-assist chain (`plan-scout -> planner`), review-fanout pattern (`coverage-reviewer`, `dependency-reviewer`, `task-quality-reviewer`), advisory-only language, non-goals, and success/failure criteria intact. If needed, tighten wording so the document explicitly states:
- planning subagents are advisory only
- implementation delegation is out of scope
- success includes reduced context overload and improved revise/review clarity
Also update the `## Artifact Layout` section to reconcile the v1 root-level `context.md` path with the existing `subagents/draft/context.md` layout. Add a scoping sentence directly under the `## Artifact Layout` heading:

```md
For the v1 scout rollout, the draft handoff lives at the plan root as `.megapowers/plans/<issue-slug>/context.md`. The `subagents/draft/` layout below is reserved for future expanded chains.
```

This ensures both locations are not left in the doc without an explicit scope explanation.

**Step 2 — Verify**
Run:
```bash
bash -lc 'grep -q "## V1 project-scoped scout rollout" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "external `pi-subagents` extension" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q ".megapowers/plans/<issue-slug>/context.md" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "plan-scout -> planner" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "coverage-reviewer" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "implementation delegation" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "Less context overload" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "For the v1 scout rollout, the draft handoff lives at the plan root as `.megapowers/plans/<issue-slug>/context.md`." .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md && grep -q "The `subagents/draft/` layout below is reserved for future expanded chains." .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md'
```
Expected: command exits 0 and confirms the doc covers the v1 handoff, draft-assist chain, review-fanout pattern, advisory-only scope, non-goals, and experiment success criteria.

Run:
```bash
bun test
```
Expected: all passing
