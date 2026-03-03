---
id: 3
title: Make deriveTasks prefer task files over plan.md parsing
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/state/derived.ts
  - tests/reproduce-090.test.ts
files_to_create: []
---

**Covers:** Fixed When #4, #5 (deriveTasks returns tasks from task files when they exist; falls back to plan.md when no task files)
**Files:**
- Modify: `extensions/megapowers/state/derived.ts`
- Modify: `tests/reproduce-090.test.ts`
- Test: `tests/reproduce-090.test.ts`
**Step 1 — Write the failing tests**

Flip the task-files assertion in `tests/reproduce-090.test.ts`:

```typescript
it("deriveTasks reads task files when they exist (ignoring plan.md)", () => {
  const slug = "001-test";
  const planDir = join(tmp, ".megapowers", "plans", slug);
  mkdirSync(planDir, { recursive: true });
  // Write task files (the new canonical format)
  const task1: PlanTask = { id: 1, title: "Set up schema", status: "approved" };
  const task2: PlanTask = { id: 2, title: "Build API", status: "approved" };
  writePlanTask(tmp, slug, task1, "Create tables for users and roles.");
  writePlanTask(tmp, slug, task2, "Build REST endpoints.");
  writeFileSync(join(planDir, "plan.md"), "# Plan\nSee task files.\n");
  const tasks = deriveTasks(tmp, slug);
  expect(tasks.length).toBe(2); // Fixed: reads task files
  expect(tasks[0].index).toBe(1);
  expect(tasks[0].description).toBe("Set up schema");
  expect(tasks[1].index).toBe(2);
  expect(tasks[1].description).toBe("Build API");
});
```

Also add a test for the fallback behavior:

```typescript
it("deriveTasks falls back to plan.md when no task files exist", () => {
  const slug = "002-fallback";
  const planDir = join(tmp, ".megapowers", "plans", slug);
  mkdirSync(planDir, { recursive: true });

  writeFileSync(join(planDir, "plan.md"), "### Task 1: Do something\n### Task 2: Do another\n");

  const tasks = deriveTasks(tmp, slug);
  expect(tasks.length).toBe(2);
  expect(tasks[0].index).toBe(1);
  expect(tasks[1].index).toBe(2);
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/reproduce-090.test.ts --filter "reads task files"`
Expected: FAIL — `expect(received).toBe(expected) // expected 2, received 0` because `deriveTasks` only reads plan.md (returns 0 tasks since plan.md has no parseable headers). The fallback test passes (existing behavior).

**Step 3 — Write minimal implementation**

Update `extensions/megapowers/state/derived.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlanTasks } from "../plan-parser.js";
import { listPlanTasks } from "./plan-store.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "../spec-parser.js";
import type { PlanTask, AcceptanceCriterion, WorkflowType } from "./state-machine.js";
import { getWorkflowConfig } from "../workflows/registry.js";
/**
 * Derive tasks from plan store (task files) or fall back to plan.md parsing.
 * Task files are the canonical source in the new plan system.
 * Returns empty array when no tasks are found from either source.
 */
export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  // Prefer task files (canonical source)
  const taskDocs = listPlanTasks(cwd, issueSlug);
  if (taskDocs.length > 0) {
    return taskDocs.map((doc) => ({
      index: doc.data.id,
      description: doc.data.title,
      completed: false,
      noTest: doc.data.no_test ?? false,
      dependsOn: doc.data.depends_on?.length ? doc.data.depends_on : undefined,
    }));
  }
  // Fall back to plan.md parsing (legacy / backward compatibility)
  const planPath = join(cwd, ".megapowers", "plans", issueSlug, "plan.md");
  if (!existsSync(planPath)) return [];
  const content = readFileSync(planPath, "utf-8");
  return extractPlanTasks(content);
}
```

Key mapping: `EntityDoc<PlanTask>` → `PlanTask` (state-machine):
- `doc.data.id` → `index`
- `doc.data.title` → `description`
- `doc.data.no_test` → `noTest`
- `doc.data.depends_on` → `dependsOn` (only if non-empty)
- `completed` always `false` (completion is tracked by `state.completedTasks[]`)
Note: `listPlanTasks` returns `EntityDoc<PlanTask>[]` where `EntityDoc<T>` has `{ data: T; content: string }` — access fields via `doc.data`, NOT `doc.meta`.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/reproduce-090.test.ts --filter "reads task files"`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
