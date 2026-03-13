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
