---
id: 7
title: Delegate plan task mode validation to plan-orchestrator
status: approved
depends_on:
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-task.ts
files_to_create:
  - tests/tool-plan-task-delegation.test.ts
---

### Task 7: Delegate plan task mode validation to plan-orchestrator [depends: 3]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-task.ts`
- Create: `tests/tool-plan-task-delegation.test.ts`

**Step 1 — Write the failing test**
Create `tests/tool-plan-task-delegation.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-task delegation", () => {
  it("uses validatePlanTaskMutation instead of inline planMode checks", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-task.ts"),
      "utf-8",
    );

    expect(source).toContain("validatePlanTaskMutation");
    expect(source).not.toContain('state.planMode === "review"');
    expect(source).not.toContain('state.planMode !== "draft" && state.planMode !== "revise"');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-task-delegation.test.ts`
Expected: FAIL — `expect(received).toContain("validatePlanTaskMutation")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-plan-task.ts`, add this import near the top:

```ts
import { validatePlanTaskMutation } from "../plan-orchestrator.js";
```

Then replace the current phase / planMode guard block inside `handlePlanTask(...)` with this exact code:

```ts
  const modeCheck = validatePlanTaskMutation(state);
  if (!modeCheck.ok) {
    return { error: modeCheck.error };
  }
```

Do not keep the old inline `state.phase !== "plan"`, `state.planMode === "review"`, or `state.planMode !== "draft" && state.planMode !== "revise"` checks.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-task-delegation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
