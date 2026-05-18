---
id: 1
title: Add allowed-actions mapping module
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/workflows/allowed-actions.ts
  - tests/allowed-actions.test.ts
---

**Files:**
- Create: `extensions/megapowers/workflows/allowed-actions.ts`
- Create: `tests/allowed-actions.test.ts`

Provides the single source of truth for which megapowers actions are allowed in each `(phase, planMode)` state. Consumed by the compact header (Task 4) and used to enforce parity with `deriveToolInstructions` (Task 7).

**Step 1 — Write the failing test**

Create `tests/allowed-actions.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getAllowedActions } from "../extensions/megapowers/workflows/allowed-actions.js";

describe("getAllowedActions", () => {
  it("plan/draft lists plan_task and plan_draft_done; warns against phase_next; no review_approve", () => {
    const a = getAllowedActions("plan", "draft");
    expect(a.signalActions).toContain("plan_draft_done");
    expect(a.planTask).toBe(true);
    expect(a.planReview).toBe(false);
    expect(a.signalActions).not.toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("plan/revise lists plan_task and plan_draft_done; warns against phase_next", () => {
    const a = getAllowedActions("plan", "revise");
    expect(a.signalActions).toContain("plan_draft_done");
    expect(a.planTask).toBe(true);
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("plan/review lists plan_review (approve+revise) and warns against review_approve and forced phase_next", () => {
    const a = getAllowedActions("plan", "review");
    expect(a.planReview).toBe(true);
    expect(a.planTask).toBe(false);
    expect(a.signalActions).not.toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("review_approve");
    expect(a.warnings.join("\n")).toContain("phase_next");
  });

  it("implement lists tests_failed, tests_passed, task_done", () => {
    const a = getAllowedActions("implement", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["tests_failed", "tests_passed", "task_done"]));
    expect(a.planTask).toBe(false);
    expect(a.planReview).toBe(false);
  });

  it("verify lists phase_next and phase_back", () => {
    const a = getAllowedActions("verify", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["phase_next", "phase_back"]));
  });

  it("code-review lists phase_next and phase_back", () => {
    const a = getAllowedActions("code-review", null);
    expect(a.signalActions).toEqual(expect.arrayContaining(["phase_next", "phase_back"]));
  });

  it("done lists close_issue and notes push/PR/cleanup", () => {
    const a = getAllowedActions("done", null);
    expect(a.signalActions).toContain("close_issue");
    expect(a.notes.join("\n").toLowerCase()).toMatch(/push|pr|cleanup/);
  });

  it("no allowed-actions entry advertises review_approve", () => {
    const phases = ["brainstorm", "spec", "plan", "implement", "verify", "code-review", "done", "reproduce", "diagnose"] as const;
    const modes = [null, "draft", "review", "revise"] as const;
    for (const p of phases) {
      for (const m of modes) {
        const a = getAllowedActions(p as any, m as any);
        expect(a.signalActions).not.toContain("review_approve");
      }
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/allowed-actions.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/workflows/allowed-actions.js' from '.../tests/allowed-actions.test.ts'`

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/workflows/allowed-actions.ts`:

```ts
import type { Phase, PlanMode } from "../state/state-machine.js";

export interface AllowedActions {
  /** megapowers_signal actions allowed (display + parity with deriveToolInstructions). */
  signalActions: string[];
  /** True if megapowers_plan_task may be called. */
  planTask: boolean;
  /** True if megapowers_plan_review may be called. */
  planReview: boolean;
  /** Phase notes shown in the compact header (e.g. push/PR allowed). */
  notes: string[];
  /** Phase warnings shown in the compact header (e.g. do not bypass review). */
  warnings: string[];
}

const EMPTY: AllowedActions = {
  signalActions: ["phase_next"],
  planTask: false,
  planReview: false,
  notes: [],
  warnings: [],
};

export function getAllowedActions(phase: Phase, planMode: PlanMode): AllowedActions {
  if (phase === "plan" && planMode === "draft") {
    return {
      signalActions: ["plan_draft_done"],
      planTask: true,
      planReview: false,
      notes: [],
      warnings: ["Do not bypass review by forcing phase_next from plan."],
    };
  }
  if (phase === "plan" && planMode === "revise") {
    return {
      signalActions: ["plan_draft_done"],
      planTask: true,
      planReview: false,
      notes: [],
      warnings: ["Do not bypass review by forcing phase_next from plan."],
    };
  }
  if (phase === "plan" && planMode === "review") {
    return {
      signalActions: [],
      planTask: false,
      planReview: true,
      notes: [],
      warnings: [
        "Do not use deprecated review_approve.",
        "Do not force phase_next from plan review.",
      ],
    };
  }
  if (phase === "implement") {
    return {
      signalActions: ["tests_failed", "tests_passed", "task_done"],
      planTask: false,
      planReview: false,
      notes: [],
      warnings: [],
    };
  }
  if (phase === "verify" || phase === "code-review") {
    return {
      signalActions: ["phase_next", "phase_back"],
      planTask: false,
      planReview: false,
      notes: [],
      warnings: [],
    };
  }
  if (phase === "done") {
    return {
      signalActions: ["close_issue"],
      planTask: false,
      planReview: false,
      notes: ["push-and-pr and post-merge cleanup are allowed in this phase."],
      warnings: [],
    };
  }
  // brainstorm/spec/reproduce/diagnose/plan (no mode) — single advance action
  return EMPTY;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/allowed-actions.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
