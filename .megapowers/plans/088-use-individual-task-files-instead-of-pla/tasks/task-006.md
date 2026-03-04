---
id: 6
title: Pipeline tool reads task content from readPlanTask instead of plan.md
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-tool.ts
  - tests/pipeline-tool.test.ts
files_to_create: []
---

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
