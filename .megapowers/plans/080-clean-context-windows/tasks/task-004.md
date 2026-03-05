---
id: 4
title: handleSignal returns triggerNewSession for task_done auto-advancing to verify
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 4: handleSignal returns triggerNewSession for task_done auto-advancing to verify

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("task_done — core behavior", ...)` block (after existing tests):

```ts
    it("returns triggerNewSession when auto-advancing to verify (all tasks complete)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only task\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("verify");
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when auto-advancing to verify"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify the `handleTaskDone` function. Find the return statement for the "all done, auto-advance to verify" case (around line 143):

Change from:
```ts
    return {
      message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.`,
    };
```

To:
```ts
    return {
      message: `Task ${currentTask.index} (${currentTask.description}) marked complete. All ${tasks.length} tasks done! Phase advanced to verify. Begin verification.`,
      triggerNewSession: true,
    };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession when auto-advancing to verify"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
