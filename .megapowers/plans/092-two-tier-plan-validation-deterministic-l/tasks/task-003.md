---
id: 3
title: Add depends_on validation to lintTask
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/validation/plan-task-linter.ts
  - tests/plan-task-linter.test.ts
files_to_create: []
---

**Covers:** AC4, AC5

**Files:**
- Modify: `extensions/megapowers/validation/plan-task-linter.ts`
- Modify: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/plan-task-linter.test.ts — add to existing file
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
import { lintTask, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";

function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 3,
    title: "Third",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["c.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — depends_on validation", () => {
  const existingTasks: PlanTask[] = [
    { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: ["a.ts"], files_to_create: [] },
    { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: ["b.ts"], files_to_create: [] },
  ];
  it("fails when depends_on has a forward reference (depId >= current task id)", () => {
    const task = makeLintTask({ depends_on: [99] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 99 (current task is 3).");
    }
  });

  it("fails when depends_on references a non-existent earlier task ID", () => {
    // task.id=3, dep=1 which is < 3 but NOT in existingTasks (empty)
    const task = makeLintTask({ id: 3, depends_on: [1] });
    const result = lintTask(task, []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on references non-existent task 1.");
    }
  });

  it("fails on self-reference (depId === current task id)", () => {
    const task = makeLintTask({ depends_on: [3] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 3 (current task is 3).");
    }
  });
  it("passes when depends_on references only existing lower IDs", () => {
    const task = makeLintTask({ depends_on: [1, 2] });
    const result = lintTask(task, existingTasks);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the forward-reference test (depId=99, task.id=3, implementation not yet added so lintTask returns pass:true for depends_on).

**Step 3 — Write minimal implementation**

Add this block inside `lintTask(...)` in `extensions/megapowers/validation/plan-task-linter.ts`:

```typescript
  // AC4: depends_on must reference existing task IDs
  // AC5: depends_on must not contain IDs >= current task ID
  if (task.depends_on.length > 0) {
    const existingIds = new Set(existingTasks.map((t) => t.id));
    for (const depId of task.depends_on) {
      if (depId >= task.id) {
        errors.push(`depends_on contains forward reference to task ${depId} (current task is ${task.id}).`);
      } else if (!existingIds.has(depId)) {
        errors.push(`depends_on references non-existent task ${depId}.`);
      }
    }
  }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
