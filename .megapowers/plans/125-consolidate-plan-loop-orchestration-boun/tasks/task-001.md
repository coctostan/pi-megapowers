---
id: 1
title: Create plan-orchestrator prompt helper module
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/plan-orchestrator.ts
  - tests/plan-orchestrator.test.ts
---

### Task 1: Create `extensions/megapowers/plan-orchestrator.ts` prompt helpers

**Files:**
- Create: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Create `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  resolvePlanTemplate,
  shouldRunFocusedReview,
} from "../extensions/megapowers/plan-orchestrator.js";

describe("plan-orchestrator — prompt helpers", () => {
  it("maps plan modes to prompt templates and only enables focused review in review mode at threshold", () => {
    expect(resolvePlanTemplate("draft")).toBe("write-plan.md");
    expect(resolvePlanTemplate("review")).toBe("review-plan.md");
    expect(resolvePlanTemplate("revise")).toBe("revise-plan.md");

    expect(shouldRunFocusedReview("draft", 10)).toBe(false);
    expect(shouldRunFocusedReview("revise", 10)).toBe(false);
    expect(shouldRunFocusedReview("review", 4)).toBe(false);
    expect(shouldRunFocusedReview("review", 5)).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `Could not resolve "../extensions/megapowers/plan-orchestrator.js"`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { PlanMode } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export function resolvePlanTemplate(planMode: Exclude<PlanMode, null>): PlanTemplateName {
  switch (planMode) {
    case "draft":
      return "write-plan.md";
    case "review":
      return "review-plan.md";
    case "revise":
      return "revise-plan.md";
  }
}

export function shouldRunFocusedReview(planMode: PlanMode, taskCount: number): boolean {
  return planMode === "review" && taskCount >= FOCUSED_REVIEW_THRESHOLD;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
