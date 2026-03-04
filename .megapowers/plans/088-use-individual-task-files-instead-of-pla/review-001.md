---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 4
  - 5
  - 8
  - 9
  - 3
  - 6
  - 7
approved_tasks:
  - 1
  - 2
  - 4
  - 5
  - 8
  - 9
needs_revision_tasks:
  - 3
  - 6
  - 7
---

### Per-Task Assessment

### Task 1: Add RequireTaskFilesGate type to types.ts — ✅ PASS
No issues. Correctly scoped as a type-only change with a concrete type-check verification step.

### Task 2: Evaluate requireTaskFiles gate as passing when task files exist — ✅ PASS
Good TDD structure and correct API usage (`listPlanTasks` in `gate-evaluator.ts`). Test and implementation align with AC5.

### Task 3: Evaluate requireTaskFiles gate as failing when no task files exist — ❌ REVISE
- **TDD completeness violation:** Step 2 says the test may already PASS; for non-`[no-test]` tasks, Step 2 must be a failing run.
- **TDD completeness violation:** Step 3 says “No additional code needed” instead of concrete implementation code.
- To keep this task independent, make Step 1 assert a stricter AC6 requirement (more descriptive message), then implement that message in Step 3.

### Task 4: Feature workflow plan→implement gate uses requireTaskFiles — ✅ PASS
Correctly targeted and uses the real workflow config/test files. Covers AC7 cleanly.

### Task 5: Bugfix workflow plan→implement gate uses requireTaskFiles — ✅ PASS
Correctly targeted and uses real workflow config/test files. Covers AC8 cleanly.

### Task 6: Pipeline tool reads task content from readPlanTask instead of plan.md — ❌ REVISE
- **Step 1 test does not verify behavior:** It never calls `handlePipelineTool`; it only scans source text.
- **AC1/AC2 risk:** Current test would not catch incorrect runtime wiring of `planSection` passed to `runPipeline`.
- **Out-of-scope conflict:** Step 3 says to remove `extractTaskSection`; spec out-of-scope explicitly says not to remove `extractTaskSection` utilities.
- Revise to a runtime test that captures implementer context and proves task-file body is used instead of `plan.md` content.

### Task 7: Pipeline tool returns error referencing task files when readPlanTask returns undefined — ❌ REVISE
- **Step 2 expected failure is ambiguous** (“either ... or ...”), not a specific expected failure.
- Step 1 includes stray unused setup code (`planDir` line), reducing self-containment quality.
- Revise with a deterministic failure assertion (e.g., no workspace/git calls before missing-task-file error), and explicit expected failure text.

### Task 8: tool-signal.ts error message references task files instead of plan.md — ✅ PASS
Focused behavior change with correct file paths and assertions. Covers AC9.

### Task 9: task-deps.ts error message references task files instead of plan.md — ✅ PASS
Focused behavior change with correct file paths and assertions. Covers AC10.

### Missing Coverage
- **AC11 is not explicitly mapped to a task.**
  - Add a final explicit task (verification-only is fine) to confirm `plan.md` generation during plan approval remains unchanged.
  - Existing coverage already exists in `tests/tool-plan-review.test.ts` (`"generates plan.md file"`) and `tests/legacy-plan-bridge.test.ts`; the plan should explicitly reference this as AC11 coverage.

### Verdict
**revise** — Tasks 3, 6, and 7 need correction, and AC11 needs explicit task coverage mapping. See `revise-instructions-1.md` for prescriptive, task-specific fixes.
