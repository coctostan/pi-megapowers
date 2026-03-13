---
id: 4
title: Add approve-path effect planning to plan-orchestrator
status: approved
depends_on:
  - 1
  - 2
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/plan-orchestrator.ts
files_to_create: []
---

### Task 4: Add approve-path effect planning to plan-orchestrator [depends: 1, 2, 3]

**Files:**
- Modify: `extensions/megapowers/plan-orchestrator.ts`
- Test: `tests/plan-orchestrator.test.ts`

**Step 1 — Write the failing test**
Replace `tests/plan-orchestrator.test.ts` with this exact content:

```ts
import { describe, it, expect } from "bun:test";
import {
  approvePlan,
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
  type PlanTask,
} from "../extensions/megapowers/state/state-machine.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask as PlanTaskDoc } from "../extensions/megapowers/state/plan-schemas.js";

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

describe("plan-orchestrator — review loop transitions", () => {
  it("validates task-mutation modes and review-loop transitions", () => {
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
    expect(validatePlanTaskMutation(makeState({ planMode: "review", planIteration: 2 })).ok).toBe(false);

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

describe("plan-orchestrator — approve effects", () => {
  it("returns approved task updates, legacy plan.md text, and the next implement state", () => {
    const taskDocs: EntityDoc<PlanTaskDoc>[] = [
      {
        data: {
          id: 1,
          title: "First task",
          status: "draft",
          depends_on: [],
          no_test: false,
          files_to_modify: ["extensions/megapowers/tools/tool-plan-review.ts"],
          files_to_create: [],
        },
        content: "Task body 1",
      },
      {
        data: {
          id: 2,
          title: "Second task",
          status: "draft",
          depends_on: [1],
          no_test: false,
          files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
          files_to_create: [],
        },
        content: "Task body 2",
      },
    ];

    const derivedTasks: PlanTask[] = [
      { index: 1, description: "First task", completed: false, noTest: false },
      { index: 2, description: "Second task", completed: false, noTest: false, dependsOn: [1] },
    ];

    const result = approvePlan(
      makeState({ planMode: "review", planIteration: 2 }),
      taskDocs,
      derivedTasks,
      (state, tasks) => ({
        ...state,
        phase: "implement",
        planMode: null,
        currentTaskIndex: tasks[0]?.index === 1 ? 0 : 99,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statusUpdates).toEqual([
        { taskId: 1, status: "approved" },
        { taskId: 2, status: "approved" },
      ]);
      expect(result.value.legacyPlanMd).toContain("### Task 1: First task");
      expect(result.value.legacyPlanMd).toContain("### Task 2: Second task [depends: 1]");
      expect(result.value.nextState.phase).toBe("implement");
      expect(result.value.nextState.planMode).toBeNull();
      expect(result.value.message).toContain("Plan approved");
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/plan-orchestrator.test.ts`
Expected: FAIL — `SyntaxError: Export named 'approvePlan' not found`

**Step 3 — Write minimal implementation**
Replace `extensions/megapowers/plan-orchestrator.ts` with this exact content:

```ts
import type { EntityDoc } from "./state/entity-parser.js";
import { generateLegacyPlanMd } from "./state/legacy-plan-bridge.js";
import type { PlanTask as PlanTaskDoc } from "./state/plan-schemas.js";
import type { MegapowersState, PlanMode, PlanTask } from "./state/state-machine.js";
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

export interface ApprovePlanEffects {
  statusUpdates: Array<{ taskId: number; status: "approved" }>;
  legacyPlanMd: string;
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

export function approvePlan(
  state: MegapowersState,
  tasks: EntityDoc<PlanTaskDoc>[],
  derivedTasks: PlanTask[],
  transitionToImplement: (state: MegapowersState, tasks: PlanTask[]) => MegapowersState,
): OrchestratorResult<ApprovePlanEffects> {
  if (state.planMode !== "review") {
    return {
      ok: false,
      error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.`,
    };
  }

  return {
    ok: true,
    value: {
      statusUpdates: tasks.map((task) => ({ taskId: task.data.id, status: "approved" as const })),
      legacyPlanMd: generateLegacyPlanMd(tasks),
      nextState: transitionToImplement(state, derivedTasks),
      message:
        `📋 Plan approved (iteration ${state.planIteration})\n` +
        `  ✅ All ${tasks.length} tasks approved\n` +
        "  → Generated plan.md for downstream consumers\n" +
        "  → Advancing to implement phase",
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
