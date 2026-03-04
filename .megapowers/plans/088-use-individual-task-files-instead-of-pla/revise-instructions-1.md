## Task 3: Evaluate requireTaskFiles gate as failing when no task files exist

Your current Task 3 is not valid TDD:
- Step 2 says the test may already PASS.
- Step 3 says “No additional code needed.”

For non-`[no-test]` tasks, Step 2 must fail first, and Step 3 must contain a real implementation change.

Revise Task 3 so it tests a stricter AC6 requirement than Task 2 and then implements it.

### What to change

1. **Step 1 test** should assert a more descriptive failure message that includes the expected task-files path for the active issue.

Use this test body:

```ts
it("fails with descriptive task-files path when no task files exist", () => {
  const store = createStore(tmp);
  const gate: GateConfig = { type: "requireTaskFiles" };
  const result = evaluateGate(gate, makeState({ phase: "plan" }), store, tmp);
  expect(result.pass).toBe(false);
  expect(result.message).toContain("No task files found");
  expect(result.message).toContain(".megapowers/plans/001-test/tasks/");
});
```

2. **Step 2 expected failure** must be specific, e.g.:

`Expected: FAIL — expect(result.message).toContain(".megapowers/plans/001-test/tasks/")`

3. **Step 3 implementation** must update `extensions/megapowers/workflows/gate-evaluator.ts` `requireTaskFiles` branch to include the issue path in the error message.

Use this shape:

```ts
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

---

## Task 6: Pipeline tool reads task content from readPlanTask instead of plan.md

Current Task 6 Step 1 is not testing runtime behavior:
- It never calls `handlePipelineTool`.
- It uses source-string checks only, while AC1/AC2 are behavioral.
- It includes unused variables (`capturedPlanSection`, `execGit`, `dispatcher`).

Also, Step 3 says to remove `extractTaskSection`; this conflicts with the issue out-of-scope note (“do not remove extractTaskSection utilities”).

### What to change

Replace Task 6 Step 1 with a runtime integration test that proves planSection comes from task-file content, not `plan.md`.

Use this test pattern in `tests/pipeline-tool.test.ts`:

```ts
it("uses task file body as planSection context instead of plan.md", async () => {
  tmp = setup(`# Plan\n\n### Task 1: Plan title\n\nPLAN_MD_MARKER\n`);

  writePlanTask(
    tmp,
    "001-test",
    {
      id: 1,
      title: "Task title",
      status: "approved",
      depends_on: [],
      no_test: false,
      files_to_modify: [],
      files_to_create: [],
    },
    "TASK_FILE_BODY_MARKER",
  );

  let implementContext = "";
  const dispatcher: Dispatcher = {
    async dispatch(cfg) {
      if (cfg.agent === "implementer") implementContext = cfg.context;
      return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null };
    },
  };

  const execGit: ExecGit = async () => ({ stdout: "", stderr: "" });
  const failingExecShell: ExecShell = async () => ({ exitCode: 1, stdout: "0 pass\n1 fail", stderr: "" });

  const r = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit, failingExecShell);
  expect(r.error).toBeUndefined();
  expect(implementContext).toContain("TASK_FILE_BODY_MARKER");
  expect(implementContext).not.toContain("PLAN_MD_MARKER");
});
```

Step 2 expected failure should be specific:

`Expected: FAIL — expect(implementContext).toContain("TASK_FILE_BODY_MARKER")`

Step 3 implementation in `extensions/megapowers/subagent/pipeline-tool.ts` must use actual API signature from `plan-store.ts`:

```ts
readPlanTask(cwd: string, slug: string, id: number)
```

and set:

```ts
const taskDoc = readPlanTask(projectRoot, state.activeIssue, task.index);
const planSection = taskDoc && !("error" in taskDoc) ? taskDoc.content : undefined;
```

Do **not** include “remove extractTaskSection” in this task.

---

## Task 7: Pipeline tool returns error referencing task files when readPlanTask returns undefined

Current Task 7 Step 2 expected failure is ambiguous (“either ... or ...”), which is not acceptable.

### What to change

1. Clean up Step 1 test code:
- Remove stray unused line:

```ts
const planDir = join(tmpdir(), "").replace(tmpdir(), tmp) || tmp;
```

2. Make failure deterministic and specific by asserting the handler exits **before** workspace creation when task file is missing.

Use this test structure in `tests/pipeline-tool.test.ts`:

```ts
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

3. Step 2 expected failure must be exact, e.g.:

`Expected: FAIL — expect(gitCalls.length).toBe(0)`

4. Step 3 implementation should move the missing-task-file guard to run **before** workspace creation in `handlePipelineTool`:

```ts
const taskDoc = readPlanTask(projectRoot, state.activeIssue, task.index);
if (!taskDoc || "error" in taskDoc) {
  return { error: `Task ${task.index} task file not found. Ensure task files exist in .megapowers/plans/${state.activeIssue}/tasks/.` };
}
const planSection = taskDoc.content;
```

This satisfies AC3 and prevents unnecessary worktree operations when task files are missing.

---

## Add Task 10: Preserve legacy plan.md generation (AC11)

AC11 is not explicitly mapped to any task right now.

Add a final task that explicitly verifies no regression to plan.md generation during approval.

You can make this a `[no-test]` verification-only task because behavior is already covered by existing tests (`tests/tool-plan-review.test.ts` has `it("generates plan.md file", ...)`).

Suggested task shape:

- Title: `Verify legacy plan.md generation remains unchanged [no-test]`
- Files: none modified
- Step 1: state that no code changes are made to `legacy-plan-bridge.ts` / approval flow
- Step 2 verify:
  - `bun test tests/tool-plan-review.test.ts -t "generates plan.md file"`
  - `bun test tests/legacy-plan-bridge.test.ts`

Also update the coverage mapping in the plan to explicitly mention Task 10 covers AC11.
