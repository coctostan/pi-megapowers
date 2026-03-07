---
id: 3
title: Clarify implement prompt guidance so planning scout is not contradicted
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/implement-task.md
files_to_create: []
---

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
