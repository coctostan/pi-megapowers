---
id: 1
title: Create LintResult type and lintTask pure function with title validation
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/validation/plan-task-linter.ts
  - tests/plan-task-linter.test.ts
---

**Covers:** AC1, AC3, AC7, AC8, AC9 (title check + files check + aggregation pattern)
**Files:**
- Create: `extensions/megapowers/validation/plan-task-linter.ts`
- Test: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

```typescript
// tests/plan-task-linter.test.ts
import { describe, it, expect } from "bun:test";
import { lintTask, type LintResult, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";
function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 1,
    title: "Valid task title",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}
describe("lintTask — title validation", () => {
  it("passes for a valid task", () => {
    const result = lintTask(makeLintTask(), []);
    expect(result).toEqual({ pass: true });
  });
  it("fails when title is empty string", () => {
    const result = lintTask(makeLintTask({ title: "" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.toLowerCase().includes("title"))).toBe(true);
    }
  });
  it("fails when title is whitespace only", () => {
    const result = lintTask(makeLintTask({ title: "   \t\n  " }), []);
    expect(result.pass).toBe(false);
  });
  it("returns all errors, not just the first", () => {
    const result = lintTask(makeLintTask({
      title: "",
      files_to_modify: [],
      files_to_create: [],
    }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/validation/plan-task-linter.js"`
**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/validation/plan-task-linter.ts
import type { PlanTask } from "../state/plan-schemas.js";
export type LintTaskInput = PlanTask & { description: string };
export type LintResult = { pass: true } | { pass: false; errors: string[] };
export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
  const errors: string[] = [];
  if (!task.title || task.title.trim().length === 0) {
    errors.push("Title must not be empty or whitespace-only.");
  }
  // AC3: Must have at least one file target
  if (task.files_to_modify.length === 0 && task.files_to_create.length === 0) {
    errors.push("Task must specify at least one file in files_to_modify or files_to_create.");
  }
  // AC9: Return all errors
  if (errors.length > 0) {
    return { pass: false, errors };
  }
  return { pass: true };
}
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing
