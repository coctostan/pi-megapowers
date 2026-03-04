---
id: 3
title: Evaluate requireTaskFiles gate as failing when no task files exist
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/gate-evaluator.ts
  - tests/gate-evaluator.test.ts
files_to_create: []
---

### Task 3: Evaluate requireTaskFiles gate as failing when no task files exist [depends: 2]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Test: `tests/gate-evaluator.test.ts`
**Step 1 — Write the failing test**

Add inside the `"evaluateGate — requireTaskFiles"` describe block in `tests/gate-evaluator.test.ts`:

```typescript
  it("fails with descriptive task-files path when no task files exist", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireTaskFiles" };
    const result = evaluateGate(gate, makeState({ phase: "plan" }), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("No task files found");
    expect(result.message).toContain(".megapowers/plans/001-test/tasks/");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/gate-evaluator.test.ts -t "fails with descriptive task-files path when no task files exist"`
Expected: FAIL — `expect(result.message).toContain(".megapowers/plans/001-test/tasks/")`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/gate-evaluator.ts`, update the `"requireTaskFiles"` case from Task 2 so the empty-task-files message includes the active-issue path:

```typescript
    case "requireTaskFiles": {
      if (!state.activeIssue || !cwd) return { pass: false, message: "No active issue or cwd" };
      const taskFiles = listPlanTasks(cwd, state.activeIssue);
      if (taskFiles.length === 0) {
        return {
          pass: false,
          message: `No task files found in .megapowers/plans/${state.activeIssue}/tasks/. Use megapowers_plan_task to create tasks before advancing.`,
        };
      }
      return { pass: true };
    }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/gate-evaluator.test.ts -t "fails with descriptive task-files path when no task files exist"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
