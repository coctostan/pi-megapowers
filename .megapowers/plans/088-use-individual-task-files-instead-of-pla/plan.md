# Plan

### Task 1: Add RequireTaskFilesGate type to types.ts [no-test]

### Task 1: Add RequireTaskFilesGate type to types.ts [no-test]

**Justification:** Type-only change — adds a new interface and adds it to the union type. No runtime behavior change.

**Files:**
- Modify: `extensions/megapowers/workflows/types.ts`

**Step 1 — Make the change**

Add the new `RequireTaskFilesGate` interface after `AllTasksCompleteGate` and add it to the `GateConfig` union:

```typescript
// After AllTasksCompleteGate (line 28)
export interface RequireTaskFilesGate {
  type: "requireTaskFiles";
}
```

Update the `GateConfig` union to include it:

```typescript
export type GateConfig =
  | RequireArtifactGate
  | NoOpenQuestionsGate
  | RequireReviewApprovedGate
  | RequirePlanApprovedGate
  | AllTasksCompleteGate
  | RequireTaskFilesGate
  | AlwaysPassGate
  | CustomGate;
```

**Step 2 — Verify**
Run: `bunx tsc --noEmit`
Expected: No type errors — the new type compiles cleanly and doesn't break existing code.

### Task 2: Evaluate requireTaskFiles gate as passing when task files exist [depends: 1]

### Task 2: Evaluate requireTaskFiles gate as passing when task files exist [depends: 1]

**Files:**
- Modify: `extensions/megapowers/workflows/gate-evaluator.ts`
- Test: `tests/gate-evaluator.test.ts`

**Step 1 — Write the failing test**

Add to `tests/gate-evaluator.test.ts`:

```typescript
describe("evaluateGate — requireTaskFiles", () => {
  it("passes when task files exist", () => {
    const store = createStore(tmp);
    const issueSlug = "001-test";
    const tasksDir = join(tmp, ".megapowers", "plans", issueSlug, "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: Do thing\nstatus: draft\n---\nBody.");

    const gate: GateConfig = { type: "requireTaskFiles" };
    const result = evaluateGate(gate, makeState({ phase: "plan" }), store, tmp);
    expect(result.pass).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/gate-evaluator.test.ts -t "passes when task files exist"`
Expected: FAIL — `Unknown gate type: requireTaskFiles` (thrown by the default case in the switch statement)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/gate-evaluator.ts`:

1. Add import for `listPlanTasks`:
```typescript
import { listPlanTasks } from "../state/plan-store.js";
```

2. Add the new case before `"alwaysPass"` in the switch:
```typescript
    case "requireTaskFiles": {
      if (!state.activeIssue || !cwd) return { pass: false, message: "No active issue or cwd" };
      const taskFiles = listPlanTasks(cwd, state.activeIssue);
      if (taskFiles.length === 0) {
        return { pass: false, message: "No task files found. Use megapowers_plan_task to create tasks before advancing." };
      }
      return { pass: true };
    }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/gate-evaluator.test.ts -t "passes when task files exist"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: Evaluate requireTaskFiles gate as failing when no task files exist [depends: 2]

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

### Task 4: Feature workflow plan→implement gate uses requireTaskFiles [depends: 1]

### Task 4: Feature workflow plan→implement gate uses requireTaskFiles [depends: 1]

**Files:**
- Modify: `extensions/megapowers/workflows/feature.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Update the existing test in `tests/workflow-configs.test.ts` that checks the plan→implement gate. Replace:

```typescript
  it("has plan → implement transition with requireArtifact + requirePlanApproved gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }]);
  });
```

With:

```typescript
  it("has plan → implement transition with requireTaskFiles + requirePlanApproved gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }]);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts -t "has plan → implement transition with requireTaskFiles"`
Expected: FAIL — `Expected: [{"type": "requireTaskFiles"}, {"type": "requirePlanApproved"}]` / `Received: [{"file": "plan.md", "type": "requireArtifact"}, {"type": "requirePlanApproved"}]`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/feature.ts`, change line 18 from:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

To:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts -t "has plan → implement transition with requireTaskFiles"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Bugfix workflow plan→implement gate uses requireTaskFiles [depends: 1]

### Task 5: Bugfix workflow plan→implement gate uses requireTaskFiles [depends: 1]

**Files:**
- Modify: `extensions/megapowers/workflows/bugfix.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**

Add a new test in `tests/workflow-configs.test.ts` inside the `"bugfix workflow config"` describe block:

```typescript
  it("has plan → implement transition with requireTaskFiles + requirePlanApproved gates", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }]);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts -t "bugfix workflow config > has plan → implement transition with requireTaskFiles"`
Expected: FAIL — `Expected: [{"type": "requireTaskFiles"}, {"type": "requirePlanApproved"}]` / `Received: [{"file": "plan.md", "type": "requireArtifact"}, {"type": "requirePlanApproved"}]`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/workflows/bugfix.ts`, change line 17 from:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] },
```

To:

```typescript
    { from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] },
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts -t "bugfix workflow config > has plan → implement transition with requireTaskFiles"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: Pipeline tool reads task content from readPlanTask instead of plan.md

### Task 6: Pipeline tool reads task content from readPlanTask instead of plan.md

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`
**Step 1 — Write the failing test**

In `tests/pipeline-tool.test.ts`, add this import with the existing imports:

```typescript
import { writePlanTask } from "../extensions/megapowers/state/plan-store.js";
```

Then add this test:

```typescript
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
        if (cfg.agent === "implementer") implementContext = cfg.context ?? "";
        return { exitCode: 0, messages: [] as any, filesChanged: [], testsPassed: null };
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
**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts -t "uses task file body as planSection context instead of plan.md"`
Expected: FAIL — `expect(implementContext).toContain("TASK_FILE_BODY_MARKER")`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/pipeline-tool.ts`:

1. Add this import:

```typescript
import { readPlanTask } from "../state/plan-store.js";
```

2. Replace the `plan.md` extraction block with task-file reading using the existing API signature `readPlanTask(cwd, slug, id)`:

```typescript
  const store = createStore(projectRoot);
  const taskDoc = readPlanTask(projectRoot, state.activeIssue, task.index);
  const planSection = taskDoc && !("error" in taskDoc) ? taskDoc.content : undefined;
```

This task only rewires runtime sourcing for `planSection`. Do **not** remove `extractTaskSection` utilities as part of this change.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts -t "uses task file body as planSection context instead of plan.md"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Pipeline tool returns error referencing task files when readPlanTask returns undefined [depends: 6]

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

### Task 8: tool-signal.ts error message references task files instead of plan.md

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

### Task 9: task-deps.ts error message references task files instead of plan.md

### Task 9: task-deps.ts error message references task files instead of plan.md

**Files:**
- Modify: `extensions/megapowers/subagent/task-deps.ts`
- Test: `tests/task-deps.test.ts`

**Step 1 — Write the failing test**

Add a new test in `tests/task-deps.test.ts`:

```typescript
  it("error message for empty tasks references task files, not plan.md", () => {
    const r = validateTaskDependencies(1, [], []);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("task file");
    expect(r.error).not.toContain("plan.md");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/task-deps.test.ts -t "error message for empty tasks references task files"`
Expected: FAIL — `expect(r.error).toContain("task file")` fails because current error message is `"No tasks found in plan. Ensure plan.md exists and has parseable tasks."`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/subagent/task-deps.ts`, change line 15 from:

```typescript
    return { valid: false, error: "No tasks found in plan. Ensure plan.md exists and has parseable tasks." };
```

To:

```typescript
    return { valid: false, error: "No tasks found. Ensure task files exist in .megapowers/plans/<issue>/tasks/." };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/task-deps.test.ts -t "error message for empty tasks references task files"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 10: Verify legacy plan.md generation remains unchanged [no-test] [depends: 1, 2, 3, 4, 5, 6, 7, 8, 9]

### Task 10: Verify legacy plan.md generation remains unchanged [depends: 1, 2, 3, 4, 5, 6, 7, 8, 9] [no-test]

**Justification:** Verification-only task. AC11 requires confirming no regression in legacy `plan.md` generation, and this behavior is already covered by existing tests. No production code changes are needed.

**Files:**
- Modify: *(none)*
- Verify: `tests/tool-plan-review.test.ts`
- Verify: `tests/legacy-plan-bridge.test.ts`

**Step 1 — Make the change**
Do not modify `legacy-plan-bridge.ts`, `tool-plan-review.ts`, or any plan-approval code paths in this task. This task is explicit regression verification that legacy `plan.md` generation remains intact after Tasks 1–9.

**Step 2 — Verify**
Run: `bun test tests/tool-plan-review.test.ts -t "generates plan.md file"`
Expected: PASS — approval flow still writes `.megapowers/plans/<issue>/plan.md`.

Run: `bun test tests/legacy-plan-bridge.test.ts`
Expected: PASS — legacy bridge still generates parseable `plan.md` output.
