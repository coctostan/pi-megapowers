---
id: 5
title: Integrate lintTask into handlePlanTask
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-task.ts
  - tests/tool-plan-task.test.ts
files_to_create: []
---

**Covers:** AC1-9 (integration — T0 blocks saves on lint failure)

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Modify: `tests/tool-plan-task.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/tool-plan-task.test.ts — add new describe block
describe("handlePlanTask — T0 lint integration", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-task-lint-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects create when description is shorter than 200 characters", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid title",
      description: "too short",
      files_to_modify: ["src/foo.ts"],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(readPlanTask(tmp, "001-test", 1)).toBeNull();
  });

  it("returns all lint errors in one aggregated response", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "   ",
      description: "short",
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Title must not be empty");
    expect(result.error).toContain("Description must be at least 200 characters");
    expect(result.error).toContain("Task must specify at least one file");
  });

  it("rejects update when merged task fails lint", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const created = handlePlanTask(tmp, {
      id: 1,
      title: "Valid",
      description: "A".repeat(200),
      files_to_modify: ["src/a.ts"],
    });
    expect(created.error).toBeUndefined();

    const result = handlePlanTask(tmp, {
      id: 1,
      files_to_modify: [],
      files_to_create: [],
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Task 1 lint failed");
    expect(result.error).toContain("Task must specify at least one file");
  });
  it("allows valid task to be saved", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const result = handlePlanTask(tmp, {
      id: 1,
      title: "Valid task",
      description: "A".repeat(220),
      files_to_modify: ["src/foo.ts"],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Task 1");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: FAIL — `Expected value to be defined, received undefined` from `expect(result.error).toBeDefined()` in the short-description test.

**Step 3 — Write minimal implementation**
Update the existing import in `extensions/megapowers/tools/tool-plan-task.ts` (line 2) to add `listPlanTasks`:

```typescript
// BEFORE (line 2):
import { readPlanTask, writePlanTask } from "../state/plan-store.js";
// AFTER:
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
```

Add a new import for the linter:
```typescript
import { lintTask } from "../validation/plan-task-linter.js";
```
Create path (`handlePlanTask`), after building `task` and before schema validation/write.
Note: after the early-return guard on missing `description`, TypeScript still can't narrow through the spread, so use a non-null assertion:
```typescript
  const lintInput = { ...task, description: params.description! };
  const existingTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, existingTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
```

Update path (`handleUpdate`), after `body` is computed (already typed as `string`) and before `writePlanTask(...)`:

```typescript
  const lintInput = { ...merged, description: body };
  const allTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
  const lintResult = lintTask(lintInput, allTasks);
  if (!lintResult.pass) {
    return {
      error: `❌ Task ${params.id} lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}`,
    };
  }
```
This preserves aggregated lint formatting so all lint findings are returned together.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
