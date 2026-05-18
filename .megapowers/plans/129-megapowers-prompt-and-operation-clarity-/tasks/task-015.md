---
id: 15
title: Standardize plan_task create/update feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-task.ts
  - tests/tool-plan-task.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Modify: `tests/tool-plan-task.test.ts`

Covers AC44, AC45, AC46, AC50, AC51. Route `handlePlanTask` success messages through `composeMessage`, ensure the artifact path is present on both create and update, the explicit field list is in `changes`, and error messages identify the action and corrective step.

Currently create returns `✅ Task N saved: "title"\n  → path\n  Changed: ...\n  depends_on: ... | files: ...` and update returns `✅ Task N updated: "title"\n  → path\n  Changed: ...`. Both already include the icon and artifact path; this task makes both routes use the shared helper consistently and tightens errors to name the action name `plan_task` and a corrective action.

**Step 1 — Write the failing test**

Append inside `describe("handlePlanTask — create", ...)` in `tests/tool-plan-task.test.ts`:

```ts
  it("create error message identifies the action and names a corrective step (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, description: "A".repeat(200) });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toContain("provide title");
  });

  it("create success uses shared ✅ icon and lists fields set (AC44, AC50)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    expect(result.error).toBeUndefined();
    expect(result.message!.startsWith("✅")).toBe(true);
    expect(result.message).toContain(".megapowers/plans/001-test/tasks/task-001.md");
    // Explicit list of fields set
    expect(result.message).toContain("title");
    expect(result.message).toContain("files_to_modify");
  });
```

Append inside `describe("handlePlanTask — update (partial merge)", ...)`:

```ts
  it("update success uses shared ✅ icon and includes artifact path + changed list (AC45, AC50, AC51)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, no_test: true });
    expect(result.message!.startsWith("✅")).toBe(true);
    expect(result.message).toContain(".megapowers/plans/001-test/tasks/task-001.md");
    expect(result.message).toContain("no_test");
  });

  it("update error message identifies plan_task and a corrective step (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    handlePlanTask(tmp, { id: 1, title: "T", description: "A".repeat(200), files_to_modify: ["src/t.ts"] });
    const result = handlePlanTask(tmp, { id: 1, files_to_modify: [], files_to_create: [] });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toContain("fix lint");
  });

  it("corrupt-existing error names plan_task and instructs to delete/recreate (AC46)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const taskDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, "task-001.md"), "---\nnot_a_field: bad\n---\nBody");
    const result = handlePlanTask(tmp, { id: 1, title: "T", description: "Body" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan_task");
    expect(result.error!.toLowerCase()).toMatch(/delete .* recreate|recreate corrupt/);
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — at least:
- `expect(result.error).toContain("plan_task")` — current error message is `❌ Task 1 invalid: title is required when creating a new task.` (no `plan_task` action name).
- `toLowerCase()).toContain("provide title")` — current text says "title is required".

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-plan-task.ts`:

1. Add import at the top:

```ts
import { composeMessage } from "../feedback.js";
```

2. Replace the title/description missing errors (lines 42–48):

```ts
  if (!params.title) {
    return { error: `❌ plan_task: Task ${params.id} invalid — title is required. Provide title when creating a new task.` };
  }

  if (!params.description) {
    return { error: `❌ plan_task: Task ${params.id} invalid — description is required. Provide description when creating a new task.` };
  }
```

3. Replace the corrupt-existing error (line 35):

```ts
    return { error: `❌ plan_task: Task ${params.id} existing file is corrupt (${existing.error}). Delete and recreate the corrupt task file.` };
```

4. Replace the lint-failed errors (lines 64–66 and 128–130):

```ts
    return {
      error: `❌ plan_task: Task ${params.id} lint failed — fix lint errors:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
```

5. Replace the Zod validation error (line 72):

```ts
    return { error: `❌ plan_task: Task ${params.id} invalid — ${issues}. Fix the listed validation errors.` };
```

6. Replace the create-success return (lines 80–86) with:

```ts
  const fields = ["title", "description", "depends_on", "no_test", "files_to_modify", "files_to_create"];
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${task.id} saved: "${task.title}"`,
      changes: [`Fields set: ${fields.join(", ")}`, `depends_on: [${depsStr}] | files: ${filesCount}`],
      artifactPath: taskPath,
    }),
  };
```

7. Replace the update-success return (lines 135–140) with:

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: `Task ${merged.id} updated: "${merged.title}"`,
      changes: [`Changed: ${changed.length > 0 ? changed.join(", ") : "no changes"}`],
      artifactPath: taskPath,
    }),
  };
```

Pre-existing tests asserting `toContain("Task 1")`, `toContain('"T"')`, `toContain("task-001.md")`, `toContain("Changed:")`, `toContain("files_to_modify")`, and `toContain("Task 1 lint failed")` still pass — the substrings remain in the composed message (lint error keeps capital `Task`).

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
