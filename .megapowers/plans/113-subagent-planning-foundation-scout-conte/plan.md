# Plan

### Task 1: Add project plan-scout agent definition [no-test]

### Task 1: Add project plan-scout agent definition [no-test]

**Justification:** prompt/skill file change — this task adds a new project-scoped agent definition in markdown and is best verified by file-content checks rather than behavioral code tests.

**Covers:** AC1, AC2, AC3, AC4, AC5

**Files:**
- Create: `.pi/agents/plan-scout.md`

**Step 1 — Make the change**
Create `.pi/agents/plan-scout.md` with this complete content:

```md
---
name: plan-scout
description: Planning scout for bounded repo context
model: anthropic/claude-sonnet-4-5
tools: read, write, bash, grep, find, ls
thinking: medium
---

You are a planning scout. Your job is to reduce planning-session context overload by producing a compact planning handoff for the main session.

## Required input
- For feature workflows, read the active `spec.md` first.
- For bugfix workflows, read the active `diagnosis.md` first.
- If neither `spec.md` nor `diagnosis.md` exists, stop and report missing required input.
- Do not fall back to a repo-only summary when the planning artifact is missing.

## Scope
Read the planning artifact plus only the repo files needed to answer these questions:
1. Which acceptance criteria or fixed-when items map to which files or symbols?
2. Which existing APIs, tests, and conventions should the planner preserve?
3. What risks, sequencing constraints, or likely task boundaries should the planner know?

## Authority boundaries
You are advisory only.
- Do not write plan tasks.
- Do not call `megapowers_plan_task`.
- Do not call `megapowers_plan_review`.
- Do not call `megapowers_signal`.
- Do not edit `.megapowers/state.json` or claim workflow authority.
- Do not approve or reject the plan.

## Output
Write a compact handoff artifact to:
`.megapowers/plans/<issue-slug>/context.md`

The file must stay bounded and include these sections:
1. `## Planning Input Summary`
2. `## Acceptance Criteria / Fixed When → Files`
3. `## Key Files`
4. `## Existing APIs, Tests, and Conventions`
5. `## Risks and Unknowns`
6. `## Suggested Task Slices`
7. `## Notes for the Main Planner`

## Output rules
- Be concrete and path-specific.
- Prefer exact file paths and symbol names over generic advice.
- Keep the artifact compact; summarize rather than narrate.
- Suggest task slices, but do not write the actual plan.
- Treat `context.md` as a planning handoff, not canonical workflow state.
- The main planning session will read `context.md` and remains responsible for `megapowers_plan_task`, `megapowers_plan_review`, and workflow transitions.
```

**Step 2 — Verify**
Run:
```bash
bash -lc 'test -f .pi/agents/plan-scout.md && grep -q "^name: plan-scout$" .pi/agents/plan-scout.md && grep -q "If neither `spec.md` nor `diagnosis.md` exists, stop and report missing required input." .pi/agents/plan-scout.md && grep -q "Do not call `megapowers_plan_task`." .pi/agents/plan-scout.md && grep -q ".megapowers/plans/<issue-slug>/context.md" .pi/agents/plan-scout.md'
```
Expected: command exits 0 and confirms the agent file exists with frontmatter, fail-closed input handling, advisory-only boundaries, and the bounded `context.md` output path.

Run:
```bash
bun test
```
Expected: all passing

### Task 2: Document context.md handoff and planning-subagent experiment rules [no-test] [depends: 1]

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

### Task 3: Clarify implement prompt guidance so planning scout is not contradicted [no-test]

### Task 3: Clarify implement prompt guidance so planning scout is not contradicted [no-test]

**Justification:** prompt-only change — this task narrows conflicting guidance in an existing prompt file and is best verified by checking the rendered prompt text plus the existing prompt test suite.

**Covers:** AC10

**Files:**
- Modify: `prompts/implement-task.md`

**Step 1 — Make the change**
In `prompts/implement-task.md`, replace the current Execution Mode warning:

```md
**Do NOT use `pipeline` or `subagent` tools.** They are broken and will produce garbage code. Do all work inline in this session.
```

with this clarified wording:

```md
**Do NOT use `pipeline` or `subagent` tools for implementation work in this session.** Do all implementation work inline here.

This restriction is specific to implement-phase task execution. Advisory planning-scout usage in the plan phase is separate.
```

Do not change the surrounding TDD instructions.

**Step 2 — Verify**
Run:
```bash
bash -lc 'grep -q "Do NOT use `pipeline` or `subagent` tools for implementation work in this session." prompts/implement-task.md && grep -q "Advisory planning-scout usage in the plan phase is separate." prompts/implement-task.md && ! grep -q "They are broken and will produce garbage code." prompts/implement-task.md'
```
Expected: command exits 0 and confirms the old blanket “broken” guidance is gone and the new wording is limited to implement-phase execution.

Run:
```bash
bun test tests/prompts.test.ts tests/prompt-inject.test.ts
```
Expected: all passing

Run:
```bash
bun test
```
Expected: all passing
