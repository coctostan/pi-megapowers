import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState, writeState } from "../state/state-io.js";
import { readPlanTask, writePlanTask, listPlanTasks, writePlanReview } from "../state/plan-store.js";
import { approvePlan, transitionReviewToRevise } from "../plan-orchestrator.js";
import { MAX_PLAN_ITERATIONS, transition, type Phase } from "../state/state-machine.js";
import { deriveTasks } from "../state/derived.js";
import type { PlanTask, PlanReview } from "../state/plan-schemas.js";

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
    return { error: "megapowers_plan_review can only be called during the plan phase." };
  }

  if (state.planMode !== "review") {
    return { error: `megapowers_plan_review requires planMode 'review', got '${state.planMode}'.` };
  }

  const slug = state.activeIssue!;

  // Gate: revise verdict requires revise-instructions file (AC5, AC6)
  if (params.verdict === "revise") {
    const filename = `revise-instructions-${state.planIteration}.md`;
    const filepath = join(cwd, ".megapowers", "plans", slug, filename);
    if (!existsSync(filepath)) {
      return {
        error:
          `Missing revise-instructions file: ${filepath}\n` +
          `Expected filename: ${filename}\n` +
          "Write it before submitting a revise verdict.",
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
  writePlanReview(cwd, slug, review, params.feedback);

  updateTaskStatuses(cwd, slug, approvedIds, "approved");
  updateTaskStatuses(cwd, slug, needsRevisionIds, "needs_revision");

  if (params.verdict === "revise") {
    return handleReviseVerdict(cwd, state, approvedIds, needsRevisionIds);
  }

  return handleApproveVerdict(cwd, state, slug);
}

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
