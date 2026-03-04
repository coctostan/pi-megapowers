---
id: 8
title: tool-signal.ts error message references task files instead of plan.md
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 8: tool-signal.ts error message references task files instead of plan.md

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add a new test in `tests/tool-signal.test.ts` inside the `"task_done — core behavior"` describe block:

```typescript
    it("error message references task files when no tasks found", () => {
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      // No plan.md or task files — deriveTasks returns []
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("task file");
      expect(result.error).not.toContain("plan.md");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "error message references task files when no tasks found"`
Expected: FAIL — `expect(result.error).toContain("task file")` fails because current error message is `"No tasks found in plan.md. Check the plan format."`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, change line 69 from:

```typescript
    return { error: "No tasks found in plan.md. Check the plan format." };
```

To:

```typescript
    return { error: "No tasks found. Ensure task files exist in .megapowers/plans/<issue>/tasks/." };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "error message references task files when no tasks found"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
