---
id: 3
title: handleSignal returns triggerNewSession for task_done advancing to next task
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 3: handleSignal returns triggerNewSession for task_done advancing to next task

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("task_done — core behavior", ...)` block (after existing tests, around line 200):

```ts
    it("returns triggerNewSession when advancing to next task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when advancing to next task"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify the `handleTaskDone` function. Find the return statement for the "advance to next task" case (around line 160):

Change from:
```ts
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
  };
```

To:
```ts
  return {
    message: `Task ${currentTask.index} (${currentTask.description}) marked complete. ${remaining} task${remaining === 1 ? "" : "s"} remaining. Next: Task ${nextTask.index}: ${nextTask.description}`,
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when advancing to next task"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
