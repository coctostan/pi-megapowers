---
id: 9
title: task-deps.ts error message references task files instead of plan.md
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/task-deps.ts
  - tests/task-deps.test.ts
files_to_create: []
---

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
