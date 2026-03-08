---
id: 2
title: Add project draft-assist chain definition
status: approved
depends_on: []
no_test: true
files_to_modify: []
files_to_create:
  - .pi/agents/draft-assist.chain.md
---

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
