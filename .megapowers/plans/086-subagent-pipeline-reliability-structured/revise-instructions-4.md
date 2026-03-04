# Revise Instructions (Iteration 4)

## Task 14: Refactor runPipeline

**Step 4** currently says:
```
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS
```

But the task also modifies `tests/pipeline-tool.test.ts` (replacing two tests and adding an import). Step 4 must verify BOTH test files pass:

```
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS
```

This ensures the pipeline-tool test updates (new `execShell` parameter, frontmatter reviewer mocks, shell-based verify mocks) are validated before running the full suite in Step 5.

## Task 16: Add pipeline-tool integration test verifying exactly 2 agents dispatched

This task has a TDD violation: Step 2 acknowledges the test passes immediately because Task 14 already removed the verifier. There is no RED phase. Since this task has **no production code change** (only adds a regression test), it should be marked `[no-test]` with an appropriate justification.

**Changes needed:**

1. Add `no_test: true` to the frontmatter
2. Remove Steps 2 and 4 (RED and GREEN phases that don't apply)
3. Keep Step 1 (the test code to add) and Step 5 (full suite verification)
4. Rename remaining steps to:
   - **Step 1 — Add the regression guard test** (the test code block)
   - **Step 2 — Verify** `bun test tests/pipeline-tool.test.ts` → PASS, then `bun test` → all passing
5. Add justification: "Regression guard test only — no production code change. Task 14 already removed the verifier agent; this test prevents re-introduction. No RED phase is possible since the behavioral change was made in Task 14."
