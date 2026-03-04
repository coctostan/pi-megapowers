---
id: 7
title: Pipeline tool returns error referencing task files when readPlanTask
  returns undefined
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-tool.ts
  - tests/pipeline-tool.test.ts
files_to_create: []
---

### Task 7: Pipeline tool returns error referencing task files when readPlanTask returns undefined [depends: 6]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`
**Step 1 — Write the failing test**

Add this test in `tests/pipeline-tool.test.ts`:

```typescript
  it("returns task-file error before workspace creation when requested task file is missing", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nBody\n`); // deriveTasks fallback from plan.md

    const gitCalls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      return { stdout: "", stderr: "" };
    };
    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null };
      },
    };
    const r = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit);
    expect(r.error).toBeDefined();
    expect(r.error).toContain("task file");
    expect(r.error).not.toContain("plan.md");
    expect(gitCalls.length).toBe(0);
  });
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts -t "returns task-file error before workspace creation when requested task file is missing"`
Expected: FAIL — `expect(gitCalls.length).toBe(0)`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-tool.ts`, move the missing-task-file guard to run **before** workspace creation:

```typescript
  const taskDoc = readPlanTask(projectRoot, state.activeIssue, task.index);
  if (!taskDoc || "error" in taskDoc) {
    return { error: `Task ${task.index} task file not found. Ensure task files exist in .megapowers/plans/${state.activeIssue}/tasks/.` };
  }
  const planSection = taskDoc.content;
```

Place this block after dependency validation and before the `pipelineId/workspacePath` branch so `createPipelineWorkspace(...)` is never called when the requested task file is missing.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts -t "returns task-file error before workspace creation when requested task file is missing"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
