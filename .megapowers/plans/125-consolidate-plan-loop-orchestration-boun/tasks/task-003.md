---
id: 3
title: Add plan review validators to plan-orchestrator
status: approved
depends_on:
  - 1
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/plan-orchestrator.ts
files_to_create: []
---

### Task 3: Add plan review validators to plan-orchestrator [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Replace `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  initializePlanLoopState,
  resolvePlanTemplate,
  shouldRunFocusedReview,
  transitionDraftToReview,
  transitionReviewToRevise,
  validatePlanTaskMutation,
} from "../extensions/megapowers/plan-orchestrator.js";
import {
  MAX_PLAN_ITERATIONS,
  createInitialState,
  type MegapowersState,
} from "../extensions/megapowers/state/state-machine.js";

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "plan",
    ...overrides,
  };
}

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

describe("plan-orchestrator — plan entry and review transitions", () => {
  it("validates task mutation modes and review-loop transitions", () => {
    const entered = initializePlanLoopState({
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    } as MegapowersState);
    expect(entered.planMode).toBe("draft");
    expect(entered.planIteration).toBe(1);

    expect(validatePlanTaskMutation(makeState({ planMode: "draft", planIteration: 1 }))).toEqual({
      ok: true,
      value: "draft",
    });
    expect(validatePlanTaskMutation(makeState({ planMode: "revise", planIteration: 2 }))).toEqual({
      ok: true,
      value: "revise",
    });

    const blocked = validatePlanTaskMutation(makeState({ planMode: "review", planIteration: 2 }));
    expect(blocked.ok).toBe(false);

    const review = transitionDraftToReview(makeState({ planMode: "draft", planIteration: 1 }), 2);
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.value.nextState.planMode).toBe("review");
      expect(review.value.message).toContain("2 tasks");
    }

    const revise = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: 1 }),
      [1],
      [2],
      MAX_PLAN_ITERATIONS,
    );
    expect(revise.ok).toBe(true);
    if (revise.ok) {
      expect(revise.value.nextState.planMode).toBe("revise");
      expect(revise.value.nextState.planIteration).toBe(2);
      expect(revise.value.message).toContain("REVISE");
    }

    const capped = transitionReviewToRevise(
      makeState({ planMode: "review", planIteration: MAX_PLAN_ITERATIONS }),
      [],
      [1],
      MAX_PLAN_ITERATIONS,
    );
    expect(capped.ok).toBe(false);
    if (!capped.ok) {
      expect(capped.error).toContain("Human intervention needed");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'transitionReviewToRevise' not found`

**Step 3 — Write minimal implementation**
Replace `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { MegapowersState, PlanMode } from "./state/state-machine.js";
import { FOCUSED_REVIEW_THRESHOLD } from "./plan-review/focused-review.js";

export type PlanTemplateName = "write-plan.md" | "review-plan.md" | "revise-plan.md";

export interface OrchestratorSuccess<T> {
  ok: true;
  value: T;
}

export interface OrchestratorFailure {
  ok: false;
  error: string;
}

export type OrchestratorResult<T> = OrchestratorSuccess<T> | OrchestratorFailure;

export interface PlanTransitionResult {
  nextState: MegapowersState;
  message: string;
}

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

export function initializePlanLoopState(state: MegapowersState): MegapowersState {
  return {
    ...state,
    planMode: "draft",
    planIteration: 1,
  };
}

export function validatePlanTaskMutation(
  state: Pick<MegapowersState, "phase" | "planMode">,
): OrchestratorResult<"draft" | "revise"> {
  if (state.phase !== "plan") {
    return { ok: false, error: "megapowers_plan_task can only be called during the plan phase." };
  }

  if (state.planMode === "review") {
    return {
      ok: false,
      error: "megapowers_plan_task is blocked during review mode. Use megapowers_plan_review to submit your verdict.",
    };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `megapowers_plan_task requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return { ok: true, value: state.planMode };
}

export function transitionDraftToReview(
  state: MegapowersState,
  taskCount: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.phase !== "plan") {
    return { ok: false, error: "plan_draft_done can only be called during the plan phase." };
  }

  if (state.planMode !== "draft" && state.planMode !== "revise") {
    return {
      ok: false,
      error: `plan_draft_done requires planMode 'draft' or 'revise', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      nextState: { ...state, planMode: "review" },
      message:
        `📝 Draft complete: ${taskCount} task${taskCount === 1 ? "" : "s"} saved\n` +
        "  → Transitioning to review mode.",
    },
  };
}

export function transitionReviewToRevise(
  state: MegapowersState,
  approvedIds: number[],
  needsRevisionIds: number[],
  maxIterations: number,
): OrchestratorResult<PlanTransitionResult> {
  if (state.planMode !== "review") {
    return {
      ok: false,
      error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.`,
    };
  }

  if (state.planIteration >= maxIterations) {
    return {
      ok: false,
      error:
        `⚠️ Plan review reached ${maxIterations} iterations without approval. Human intervention needed.\n` +
        "  Use /mega off to disable enforcement and manually advance, or revise the spec.",
    };
  }

  return {
    ok: true,
    value: {
      nextState: {
        ...state,
        planMode: "revise",
        planIteration: state.planIteration + 1,
      },
      message:
        `📋 Plan review: REVISE (iteration ${state.planIteration + 1} of ${maxIterations})\n` +
        `  ✅ Tasks ${approvedIds.join(", ") || "none"} approved\n` +
        `  ⚠️ Tasks ${needsRevisionIds.join(", ") || "none"} need revision\n` +
        "  → Transitioning to revise mode. A new review session will start.",
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
