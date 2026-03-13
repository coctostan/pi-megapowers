---
id: 2
title: Add plan entry and draft-submission transitions to plan-orchestrator
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/plan-orchestrator.ts
files_to_create: []
---

### Task 2: Add plan entry and draft-submission transitions to plan-orchestrator [depends: 1]

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
} from "../extensions/megapowers/plan-orchestrator.js";
import {
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

describe("plan-orchestrator — plan entry and draft submission", () => {
  it("initializes plan loop state and only allows draft submission from draft or revise mode", () => {
    const entered = initializePlanLoopState({
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    } as MegapowersState);
    expect(entered.planMode).toBe("draft");
    expect(entered.planIteration).toBe(1);

    const draft = transitionDraftToReview(makeState({ planMode: "draft", planIteration: 1 }), 2);
    expect(draft.ok).toBe(true);
    if (draft.ok) {
      expect(draft.value.nextState.planMode).toBe("review");
      expect(draft.value.message).toContain("2 tasks");
    }

    const revise = transitionDraftToReview(makeState({ planMode: "revise", planIteration: 2 }), 1);
    expect(revise.ok).toBe(true);

    const wrongMode = transitionDraftToReview(makeState({ planMode: "review", planIteration: 2 }), 1);
    expect(wrongMode.ok).toBe(false);
    if (!wrongMode.ok) {
      expect(wrongMode.error).toContain("draft");
    }

    const wrongPhase = transitionDraftToReview(
      makeState({ phase: "implement", planMode: null }),
      1,
    );
    expect(wrongPhase.ok).toBe(false);
    if (!wrongPhase.ok) {
      expect(wrongPhase.error).toContain("plan phase");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'initializePlanLoopState' not found`

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
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
