---
id: 4
title: Add duplicate files_to_create cross-task check to lintTask
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/validation/plan-task-linter.ts
  - tests/plan-task-linter.test.ts
files_to_create: []
---

**Covers:** AC6

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
    id: 2,
    title: "Second",
    status: "draft",
    depends_on: [1],
    no_test: false,
    files_to_modify: [],
    files_to_create: ["src/new-module.ts"],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — duplicate files_to_create", () => {
  it("fails when files_to_create overlaps another task's files_to_create", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeLintTask(), existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain('files_to_create path "src/new-module.ts" is already claimed by another task.');
    }
  });

  it("passes when files_to_create has no overlap", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/a.ts"] },
    ];

    const result = lintTask(makeLintTask({ files_to_create: ["src/b.ts"] }), existingTasks);
    expect(result).toEqual({ pass: true });
  });

  it("allows update of the same task without self-conflict", () => {
    const existingTasks: PlanTask[] = [
      { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeLintTask({ id: 2 }), existingTasks);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the overlap test.

**Step 3 — Write minimal implementation**

Add this block inside `lintTask(...)` in `extensions/megapowers/validation/plan-task-linter.ts`:

```typescript
  // AC6: files_to_create must not duplicate another task's files_to_create
  if (task.files_to_create.length > 0) {
    const claimedPaths = new Set<string>();
    for (const existing of existingTasks) {
      // Skip self during updates
      if (existing.id === task.id) continue;
      for (const filePath of existing.files_to_create) {
        claimedPaths.add(filePath);
      }
    }
    for (const filePath of task.files_to_create) {
      if (claimedPaths.has(filePath)) {
        errors.push(`files_to_create path "${filePath}" is already claimed by another task.`);
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
