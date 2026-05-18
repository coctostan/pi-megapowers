---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
  - 14
  - 17
  - 5
  - 15
  - 16
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
  - 14
  - 17
needs_revision_tasks:
  - 5
  - 15
  - 16
---

Three string-literal collisions with pre-existing tests will cause the suite to fail. See `revise-instructions-1.md` for exact wording fixes per task.

- **Task 5**: new `buildIdlePrompt` drops `/mega on|off` but `tests/prompt-inject.test.ts:406` still asserts it. Add `/mega on|off` to the idle prompt's compact `Commands:` line.
- **Task 15**: new `plan_task` error string lowercases "task" — breaks `expect(result.error).toContain("Task 1 lint failed")` at `tests/tool-plan-task.test.ts:201, 218, 242`. Rephrase as `❌ plan_task: Task ${id} lint failed — ...` to satisfy both AC46 and existing assertions.
- **Task 16**: cap-error summary lowercases "human" — breaks `tests/plan-orchestrator.test.ts:92` (`toContain("Human intervention needed")`). Use capital `H`.

All other tasks pass review: APIs and signatures verified against the codebase (`loadPromptFile`, `composeMessage`, `getAllowedActions` types, `deriveToolInstructions`, `transition`, `approvePlan`, `transitionReviewToRevise`, `writeFileSync` of `plan.md`), dependency ordering is sound, TDD steps are concrete and self-contained, and every AC (1–63) is covered.
