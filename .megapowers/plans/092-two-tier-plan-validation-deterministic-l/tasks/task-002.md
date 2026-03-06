---
id: 2
title: Add description minimum length check to lintTask
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/validation/plan-task-linter.ts
  - tests/plan-task-linter.test.ts
files_to_create: []
---

**Covers:** AC2, AC8
**Files:**
- Modify: `extensions/megapowers/validation/plan-task-linter.ts`
- Modify: `tests/plan-task-linter.test.ts`
**Step 1 — Write the failing test**

Append to the existing `tests/plan-task-linter.test.ts` file (reuse the `makeLintTask` helper from Task 1):

```typescript
// tests/plan-task-linter.test.ts — add new describe block
describe("lintTask — description length", () => {
  it("fails when description is shorter than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "Short desc" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("Description must be at least 200 characters (got 10).");
    }
  });
  it("passes when description is exactly 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(200) }), []);
    expect(result).toEqual({ pass: true });
  });
  it("passes when description is longer than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(300) }), []);
    expect(result).toEqual({ pass: true });
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: FAIL — `Expected: false\nReceived: true` from `expect(result.pass).toBe(false)` in the short-description test.
**Step 3 — Write minimal implementation**

Add the description check to `lintTask` in `extensions/megapowers/validation/plan-task-linter.ts`, after the title check and before the files check:

```typescript
const MIN_DESCRIPTION_LENGTH = 200;
// Inside lintTask, after the title check:
  if (task.description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
  }
```

No type changes needed — `LintTaskInput` already includes `description: string` from Task 1.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-task-linter.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
