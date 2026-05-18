import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState, writeState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks, writePlanReview } from "../state/plan-store.js";
import { approvePlan, transitionReviewToRevise } from "../plan-orchestrator.js";
import { MAX_PLAN_ITERATIONS, transition, type Phase } from "../state/state-machine.js";
import { deriveTasks } from "../state/derived.js";
import type { PlanTask, PlanReview } from "../state/plan-schemas.js";
import { composeMessage } from "../feedback.js";

export interface PlanReviewParams {
  verdict: "approve" | "revise";
  feedback: string;
  approved_tasks?: number[];
  needs_revision_tasks?: number[];
}

export interface PlanReviewResult {
  message?: string;
  error?: string;
  triggerNewSession?: boolean;
}

export function handlePlanReview(cwd: string, params: PlanReviewParams): PlanReviewResult {
  const state = readState(cwd);

  if (state.phase !== "plan") {
    return { error: "❌ plan_review: not in plan phase. Submit during plan review." };
  }

  if (state.planMode !== "review") {
    return { error: `❌ plan_review: not in review mode (got planMode '${state.planMode}'). Submit during plan review.` };
  }

  const slug = state.activeIssue!;

  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return {
        error: composeMessage({
          icon: "error",
          summary: `plan_review: missing revise-instructions file at ${filepath}`,
          nextStep: `Write the ${filename} file before submitting a revise verdict.`,
        }),
      };
    }
  }
  const approvedIds = params.approved_tasks ?? [];
  const needsRevisionIds = params.needs_revision_tasks ?? [];

  const review: PlanReview = {
    type: "plan-review",
    iteration: state.planIteration,
    verdict: params.verdict,
    reviewed_tasks: [...approvedIds, ...needsRevisionIds],
    approved_tasks: approvedIds,
    needs_revision_tasks: needsRevisionIds,
  };
  if (params.verdict === "revise") {
    const orchestrated = transitionReviewToRevise(
      state,
      approvedIds,
      needsRevisionIds,
      MAX_PLAN_ITERATIONS,
    );
    if (!orchestrated.ok) {
      return { error: orchestrated.error };
    }
    writePlanReview(cwd, slug, review, params.feedback);
    updateTaskStatuses(cwd, slug, approvedIds, "approved");
    updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
    writeState(cwd, orchestrated.value.nextState);
    return {
      message: orchestrated.value.message,
      triggerNewSession: true,
    };
  }

  writePlanReview(cwd, slug, review, params.feedback);
  updateTaskStatuses(cwd, slug, approvedIds, "approved");
  updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");
  return handleApproveVerdict(cwd, state, slug);
}


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
    message: composeMessage({
      icon: "success",
      summary: `Plan approved (iteration ${state.planIteration})`,
      changes: [`All ${tasks.length} tasks approved`],
      artifactPath: `.megapowers/plans/${slug}/plan.md`,
      nextStep: "Advancing to implement phase.",
    }),
    triggerNewSession: true,
  };
}

function updateTaskStatuses(
  cwd: string,
  slug: string,
  taskIds: number[],
  status: "approved" | "needs_revision",
): void {
  for (const id of taskIds) {
    const existing = readPlanTask(cwd, slug, id);
    if (existing && !("error" in existing)) {
      const updated: PlanTask = { ...existing.data, status };
      writePlanTask(cwd, slug, updated, existing.content);
    }
  }
}
