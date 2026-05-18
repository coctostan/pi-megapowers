---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
approved_tasks: []
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
---

### Per-Task Assessment

### Task 1: Derive compact context summary — ❌ REVISE
- The canonical task file is not self-contained. It contains only a summary and a pointer to `plan.md`, not the required 5 TDD steps.
- Step 1 test code and Step 3 implementation code are absent from `task-001.md`.
- The task file does not explicitly list AC coverage.

### Task 2: Update hook status indicator — ❌ REVISE
- The canonical task file is not self-contained. It lacks the full failing test and full implementation code for `onBeforeAgentStart`.
- It has no Step 1–Step 5 structure in the task file.
- The task file does not explicitly list AC coverage.

### Task 3: Render default context inspection report — ❌ REVISE
- The canonical task file is summary-only and omits the complete test and implementation.
- It does not include Step 1–Step 5 with runnable code and commands.
- The task file does not explicitly list AC coverage.

### Task 4: Render debug context inspection report — ❌ REVISE
- The canonical task file is summary-only and omits the complete debug-mode test and implementation change.
- It does not include Step 1–Step 5 with runnable code and commands.
- The task file does not explicitly list AC coverage.

### Task 5: Add `/mega context` command — ❌ REVISE
- The canonical task file is summary-only and omits the complete `tests/commands-context.test.ts` source and command implementation branch.
- It does not include Step 1–Step 5 with runnable code and commands.
- The task file does not explicitly list AC coverage.

### Task 6: Add `/mp context` command — ❌ REVISE
- The canonical task file is summary-only and omits the complete appended `/mp context` test and registry implementation.
- It does not include Step 1–Step 5 with runnable code and commands.
- The task file does not explicitly list AC coverage.

### Missing Coverage
No acceptance criteria appear conceptually uncovered in `plan.md`, but the structured task files do not reference AC identifiers. Add explicit `**Covers:** AC ...` lines to each task file as specified in `revise-instructions-1.md`.

### Verdict
**revise** — the high-level plan in `plan.md` contains useful detail, but the canonical task files saved through `megapowers_plan_task` are not executable, self-contained TDD tasks. The reviser must replace each summary-only task description with the full task body from `plan.md`, including complete test/implementation code and AC references.
