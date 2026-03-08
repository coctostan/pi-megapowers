# Plan

### Task 1: Add project revise-helper agent definition [no-test]

### Task 1: Add project revise-helper agent definition [no-test]

**Justification:** prompt change only — this task adds a project-scoped advisory agent definition and does not change executable runtime code.

**Files:**
- Create: `.pi/agents/revise-helper.md`

**Covers AC:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

**Step 1 — Make the change**
Create `.pi/agents/revise-helper.md` with this complete content:

```md
---
name: revise-helper
description: Targeted plan-revision advisor for affected tasks only
model: anthropic/claude-sonnet-4-5
tools: read, write, bash, grep, find, ls
thinking: medium
---

You are a targeted revise helper for Megapowers plan revision. Your only job is to help the main session revise only the tasks called out by the latest reviewer instructions.

## Required input
- Read the latest `.megapowers/plans/<issue-slug>/revise-instructions-N.md` first.
- Then read only the affected task files under `.megapowers/plans/<issue-slug>/tasks/` that those revise instructions identify.
- Do not reread or rewrite unaffected task files by default.
- Do not read prior review artifacts unless the revise instructions reference a coverage or dependency concern or name those artifacts directly.
- If the latest revise instructions are missing, stop and report the missing input instead of inventing revisions.

## Scope
Analyze only:
1. What concrete task-body replacements or edit snippets would fix the affected tasks.
2. Whether those local fixes create obvious coverage or dependency fallout elsewhere in the plan.
3. What the main session should update before resubmitting the plan.

## Authority boundaries
You are advisory only.
- Do not call `megapowers_plan_task`.
- Do not call `megapowers_plan_review`.
- Do not call `megapowers_signal`.
- Do not edit `.megapowers/state.json`.
- Do not approve or reject the plan.
- The main session performs the actual task edits and resubmission.

## Output
Write your artifact to:
`.megapowers/plans/<issue-slug>/revise-proposal.md`

Use this bounded format:

```md
## Revision Summary
- Latest instructions: `revise-instructions-N.md`
- Affected tasks: Task X, Task Y

## Task-Local Fixes
- Task X
  - Problem: [one concrete sentence]
  - Replace with:
    ```md
    [exact replacement section or edit snippet]
    ```
- Task Y
  - Problem: [one concrete sentence]
  - Replace with:
    ```md
    [exact replacement section or edit snippet]
    ```

## Global Sanity Check
- Coverage fallout: none | [one short concrete bullet]
- Dependency fallout: none | [one short concrete bullet]

## Notes for the Main Session
- [up to 3 short bullets]
```

## Output rules
- Stay tightly scoped to the affected tasks.
- Prefer exact replacement text or edit snippets over broad advice.
- Do not rewrite unaffected tasks.
- Keep the global sanity check short and concrete.
- Treat `revise-proposal.md` as advisory only; the main session remains responsible for real task edits and resubmission.
```

**Step 2 — Verify**
Run: `bash -lc 'test -f .pi/agents/revise-helper.md && grep -q "^name: revise-helper$" .pi/agents/revise-helper.md && grep -q "read the latest `.megapowers/plans/<issue-slug>/revise-instructions-N.md` first" .pi/agents/revise-helper.md && grep -q "read only the affected task files" .pi/agents/revise-helper.md && grep -q "Do not rewrite unaffected tasks" .pi/agents/revise-helper.md && grep -q "revise-proposal.md" .pi/agents/revise-helper.md && grep -q "## Task-Local Fixes" .pi/agents/revise-helper.md && grep -q "## Global Sanity Check" .pi/agents/revise-helper.md && grep -q "Do not call `megapowers_plan_task`" .pi/agents/revise-helper.md && grep -q "Do not call `megapowers_plan_review`" .pi/agents/revise-helper.md && grep -q "Do not call `megapowers_signal`" .pi/agents/revise-helper.md && grep -q "main session performs the actual task edits and resubmission" .pi/agents/revise-helper.md'`
Expected: command exits 0 and confirms the agent file defines narrow revise-only scope, bounded `revise-proposal.md` output, no unaffected-task rewrites, optional review-artifact reads only when explicitly relevant, and advisory-only authority boundaries.

### Task 2: Add project draft-assist chain definition [no-test]

### Task 2: Add project draft-assist chain definition [no-test]

**Justification:** chain-definition prompt/config only — this task adds a reusable sequential `.chain.md` file and does not change runtime code.

**Files:**
- Create: `.pi/agents/draft-assist.chain.md`

**Covers AC:** 14, 15, 16, 17, 18, 19, 20, 21, 22, 23

**Step 1 — Make the change**
Create `.pi/agents/draft-assist.chain.md` with this complete content:

```md
---
name: draft-assist
description: Run plan-scout then planner for bounded draft assistance
---

## plan-scout
output: context.md

Read the active planning artifact for `{task}` and produce a bounded planning handoff in `context.md`.
Stay advisory only and do not create canonical plan task state.

## planner
reads: context.md
model: anthropic/claude-sonnet-4-5:high
progress: true

Read `context.md` and produce an advisory planning draft for `{task}`.
Use the scout output to suggest task slices, ordering, and coverage notes.
Do not create canonical plan task files.
Do not call `megapowers_plan_task`.
Do not call `megapowers_plan_review`.
Do not call `megapowers_signal`.
The main planning session remains responsible for actual task creation, review submission, and workflow transitions.
```

**Step 2 — Verify**
Run: `bash -lc 'test -f .pi/agents/draft-assist.chain.md && grep -q "^name: draft-assist$" .pi/agents/draft-assist.chain.md && grep -q "^description: Run plan-scout then planner for bounded draft assistance$" .pi/agents/draft-assist.chain.md && grep -q "^## plan-scout$" .pi/agents/draft-assist.chain.md && grep -q "^output: context.md$" .pi/agents/draft-assist.chain.md && grep -q "^## planner$" .pi/agents/draft-assist.chain.md && grep -q "^reads: context.md$" .pi/agents/draft-assist.chain.md && grep -q "Do not create canonical plan task files" .pi/agents/draft-assist.chain.md && grep -q "Do not call `megapowers_plan_task`" .pi/agents/draft-assist.chain.md && grep -q "Do not call `megapowers_plan_review`" .pi/agents/draft-assist.chain.md && grep -q "Do not call `megapowers_signal`" .pi/agents/draft-assist.chain.md && grep -q "main planning session remains responsible for actual task creation" .pi/agents/draft-assist.chain.md'`
Expected: command exits 0 and confirms the chain file has valid frontmatter, a `plan-scout` step, a later `planner` step that consumes `context.md`, bounded artifact naming, and advisory-only instructions that keep megapowers tool calls in the main session.

### Task 3: Document reusable review-fanout planning pattern [no-test]

### Task 3: Document reusable review-fanout planning pattern [no-test]

**Justification:** documentation-only change — this task adds a project doc that captures an already-supported review pattern without changing runtime behavior.

**Files:**
- Create: `.megapowers/docs/115-review-fanout-pattern.md`

**Covers AC:** 24, 25, 26, 27, 28, 29

**Step 1 — Make the change**
Create `.megapowers/docs/115-review-fanout-pattern.md` with this complete content:

```md
# Review fan-out planning pattern

## Goal
Capture the reusable project-level invocation pattern for focused plan review without pretending that saved markdown chains support parallel fan-out today.

## Pattern
Run these three project agents in parallel against the active planning artifact and current task files:
- `coverage-reviewer`
- `dependency-reviewer`
- `task-quality-reviewer`

## Inputs
- `.megapowers/plans/<issue-slug>/spec.md` for feature workflows or `.megapowers/plans/<issue-slug>/diagnosis.md` for bugfix workflows
- every current task file under `.megapowers/plans/<issue-slug>/tasks/`

## Bounded outputs
- `coverage-reviewer` writes `.megapowers/plans/<issue-slug>/coverage-review.md`
- `dependency-reviewer` writes `.megapowers/plans/<issue-slug>/dependency-review.md`
- `task-quality-reviewer` writes `.megapowers/plans/<issue-slug>/task-quality-review.md`

## Main-session ownership
- These outputs are advisory artifacts only.
- The main review session reads and synthesizes the focused review outputs.
- Final `megapowers_plan_review` submission remains in the main session.
- Subagents do not own workflow transitions or canonical plan state.

## Non-goals
- This pattern does not add new megapowers runtime orchestration.
- This pattern does not add saved parallel `.chain.md` support.
- This pattern does not replace the main session's final review authority.
```

**Step 2 — Verify**
Run: `bash -lc 'test -f .megapowers/docs/115-review-fanout-pattern.md && grep -q "coverage-reviewer" .megapowers/docs/115-review-fanout-pattern.md && grep -q "dependency-reviewer" .megapowers/docs/115-review-fanout-pattern.md && grep -q "task-quality-reviewer" .megapowers/docs/115-review-fanout-pattern.md && grep -q "coverage-review.md" .megapowers/docs/115-review-fanout-pattern.md && grep -q "dependency-review.md" .megapowers/docs/115-review-fanout-pattern.md && grep -q "task-quality-review.md" .megapowers/docs/115-review-fanout-pattern.md && grep -q "advisory artifacts only" .megapowers/docs/115-review-fanout-pattern.md && grep -q "main review session reads and synthesizes the focused review outputs" .megapowers/docs/115-review-fanout-pattern.md && grep -q "Final `megapowers_plan_review` submission remains in the main session" .megapowers/docs/115-review-fanout-pattern.md'`
Expected: command exits 0 and confirms the project doc names the three focused reviewers, their bounded output artifacts, advisory-only scope, main-session synthesis responsibility, and main-session ownership of final `megapowers_plan_review` submission.
