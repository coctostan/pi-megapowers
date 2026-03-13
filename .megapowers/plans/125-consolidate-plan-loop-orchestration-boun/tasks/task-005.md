---
id: 5
title: Delegate plan review verdict handling to plan-orchestrator
status: approved
depends_on:
  - 3
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-review.ts
files_to_create:
  - tests/tool-plan-review-delegation.test.ts
---

### Task 5: Delegate plan review verdict handling to plan-orchestrator [depends: 3, 4]

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Create: `tests/tool-plan-review-delegation.test.ts`

**Step 1 — Write the failing test**
Create `tests/tool-plan-review-delegation.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-review delegation", () => {
  it("delegates revise and approve flows to plan-orchestrator", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-review.ts"),
      "utf-8",
    );

    expect(source).toContain("transitionReviewToRevise");
    expect(source).toContain("approvePlan");
    expect(source).not.toContain("generateLegacyPlanMd(");
    expect(source).not.toContain('planMode: "revise"');
    expect(source).not.toContain('planIteration: state.planIteration + 1');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-plan-review-delegation.test.ts`
Expected: FAIL — `expect(received).toContain("transitionReviewToRevise")`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/tools/tool-plan-review.ts`, update the imports to this exact block:

```ts
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState, writeState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks, writePlanReview } from "../state/plan-store.js";
import { approvePlan, transitionReviewToRevise } from "../plan-orchestrator.js";
import { MAX_PLAN_ITERATIONS, transition, type Phase } from "../state/state-machine.js";
import { deriveTasks } from "../state/derived.js";
import type { PlanTask, PlanReview } from "../state/plan-schemas.js";
```

Then replace the entire `handleReviseVerdict(...)` function with:

```ts
function handleReviseVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  approvedIds: number[],
  needsRevisionIds: number[],
): PlanReviewResult {
  const orchestrated = transitionReviewToRevise(
    state,
    approvedIds,
    needsRevisionIds,
    MAX_PLAN_ITERATIONS,
  );
  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  writeState(cwd, orchestrated.value.nextState);
  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

Then replace the entire `handleApproveVerdict(...)` function with:

```ts
function handleApproveVerdict(
  cwd: string,
  state: ReturnType<typeof readState>,
  slug: string,
): PlanReviewResult {
  const tasks = listPlanTasks(cwd, slug);
  const derivedTasks = deriveTasks(cwd, slug);
  const orchestrated = approvePlan(state, tasks, derivedTasks, (currentState, nextTasks) =>
    transition(currentState, "implement" as Phase, nextTasks),
  );

  if (!orchestrated.ok) {
    return { error: orchestrated.error };
  }

  updateTaskStatuses(
    cwd,
    slug,
    orchestrated.value.statusUpdates.map((update) => update.taskId),
    "approved",
  );

  const planDir = join(cwd, ".megapowers", "plans", slug);
  writeFileSync(join(planDir, "plan.md"), orchestrated.value.legacyPlanMd);
  writeState(cwd, orchestrated.value.nextState);

  return {
    message: orchestrated.value.message,
    triggerNewSession: true,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-plan-review-delegation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
