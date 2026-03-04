---
id: 2
title: Evaluate requireTaskFiles gate as passing when task files exist
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/gate-evaluator.ts
files_to_create: []
---

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
