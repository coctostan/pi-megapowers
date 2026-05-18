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
