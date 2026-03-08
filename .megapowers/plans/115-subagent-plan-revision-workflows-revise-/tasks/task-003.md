---
id: 3
title: Document reusable review-fanout planning pattern
status: approved
depends_on: []
no_test: true
files_to_modify: []
files_to_create:
  - .megapowers/docs/115-review-fanout-pattern.md
---

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
