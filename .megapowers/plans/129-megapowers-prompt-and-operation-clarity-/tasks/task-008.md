---
id: 8
title: Standardize handleSignal task_done feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC37. Updates `handleTaskDone` success messages to use `composeMessage` from `feedback.ts` so both the auto-advance-to-verify and next-task paths start with `✅`, name the completed task (index + description), state remaining-task count, and give an explicit next step.

**Step 1 — Write the failing test**

Append inside `describe("handleSignal", () => { ... describe("task_done — core behavior") })` in `tests/tool-signal.test.ts`:

```ts
    it("task_done success message starts with ✅ and names completed task index + description (AC36, AC37)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build it\n\n### Task 2: Polish\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const r = handleSignal(tmp, "task_done");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("Task 1");
      expect(r.message).toContain("Build it");
      // Remaining count + next task identifier (AC37)
      expect(r.message).toMatch(/1 task remaining/);
      expect(r.message).toContain("Task 2");
    });

    it("task_done message on final task names auto-advance to verify (AC37)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const r = handleSignal(tmp, "task_done");
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("Task 1");
      expect(r.message).toContain("Only");
      expect(r.message!.toLowerCase()).toContain("verify");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "task_done success message starts with"`
Expected: FAIL — `expect(r.message.startsWith("✅")).toBe(true)` — actual message is `Task 1 (Build it) marked complete. ...` (no leading icon).

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

1. Add the import at the top of the file (next to the other imports):

```ts
import { composeMessage } from "../feedback.js";
```

2. In `handleTaskDone` (existing function at line 62), replace the two `return { message: ..., triggerNewSession: true }` blocks (lines 141–144 and 159–162) with `composeMessage` calls:

```ts
  if (allDone) {
    // Auto-advance to verify
    const updatedState = {
      ...state,
      completedTasks,
      tddTaskState: null,
    };
    const newState = transition(updatedState, "verify" as Phase);
    writeState(cwd, newState);
    return {
      message: composeMessage({
        icon: "success",
        summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
        changes: [`All ${tasks.length} tasks done`],
        nextStep: "Phase advanced to verify — begin verification.",
      }),
      triggerNewSession: true,
    };
  }

  // Advance to next task
  const nextIdx = nextIncompleteIdx >= 0 ? nextIncompleteIdx : state.currentTaskIndex;
  const nextTask = tasks[nextIdx];
  const updatedState = {
    ...state,
    completedTasks,
    currentTaskIndex: nextIdx,
    tddTaskState: null,
  };
  writeState(cwd, updatedState);

  const remaining = tasks.length - completedTasks.length;
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${currentTask.index} (${currentTask.description}) marked complete`,
      changes: [`${remaining} task${remaining === 1 ? "" : "s"} remaining`],
      nextStep: `Task ${nextTask.index}: ${nextTask.description}`,
    }),
    triggerNewSession: true,
  };
```

Pre-existing tests that assert `result.message).toContain("Task 2")`, `toContain("verify")`, and `toContain("complete")` still pass because the composed message preserves those substrings.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "task_done"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
