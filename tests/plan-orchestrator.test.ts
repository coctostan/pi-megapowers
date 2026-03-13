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
