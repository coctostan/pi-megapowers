# Revise Instructions — Iteration 1

## Task 4: Remove legacy delegation wording from implement prompts

### Problem
Step 1 replaces the entire `describe("implement prompt — subagent delegation instructions", ...)` block (lines 307–374 of `tests/prompts.test.ts`) with only 4 tests, but the existing block contains 8 tests. Four non-legacy tests are silently dropped:

1. `"remaining_tasks is sentinel when no tasks remain after current"` (line 345)
2. `"remaining_tasks shows tasks as ready when their dependencies are complete"` (line 353)
3. `"implement-task template instructs tests_failed signal after RED test failure"` (line 365)
4. `"implement-task template instructs tests_passed signal after GREEN test pass"` (line 370)

These test general `buildImplementTaskVars` / template behavior, not legacy pipeline/subagent infrastructure. Dropping them is an unjustified test coverage regression.

### Fix
Add the following 4 tests to the replacement `describe` block in Step 1 (after the existing 4 tests):

```ts
  it("remaining_tasks is sentinel when no tasks remain after current", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Only task", completed: false, noTest: false },
    ];
    const vars = buildImplementTaskVars(tasks, 0);
    expect(vars.remaining_tasks).toBe("None — this is the only remaining task.");
  });

  it("remaining_tasks shows tasks as ready when their dependencies are complete", () => {
    const tasks: PlanTask[] = [
      { index: 1, description: "Types", completed: true, noTest: false },
      { index: 2, description: "Auth", completed: false, noTest: false, dependsOn: [1] },
      { index: 3, description: "Logging", completed: false, noTest: false, dependsOn: [1] },
    ];
    const vars = buildImplementTaskVars(tasks, 1);
    expect(vars.remaining_tasks).toContain("Task 3");
    expect(vars.remaining_tasks).not.toMatch(/Task 3.*blocked/i);
  });

  it("implement-task template instructs tests_failed signal after RED test failure", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_failed" })');
  });

  it("implement-task template instructs tests_passed signal after GREEN test pass", () => {
    const template = getPhasePromptTemplate("implement");
    expect(template).toContain('megapowers_signal({ action: "tests_passed" })');
  });
```

The full replacement block should now have 8 tests total. All 8 should pass after Step 3's implementation change, so Step 2's expected failure is unchanged (only the "delegated to subagent" → "can be implemented now" assertions cause the failure).
