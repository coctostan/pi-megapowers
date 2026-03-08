import type { WorkflowType } from "../state/state-machine.js";

export const FOCUSED_REVIEW_THRESHOLD = 5;
export const FOCUSED_REVIEW_AGENTS = [
  "coverage-reviewer",
  "dependency-reviewer",
  "task-quality-reviewer",
] as const;

export type FocusedReviewAgent = (typeof FOCUSED_REVIEW_AGENTS)[number];

export interface FocusedReviewFanoutTask {
  agent: FocusedReviewAgent;
  task: string;
}

export interface FocusedReviewFanoutPlan {
  runtime: "pi-subagents";
  mode: "parallel";
  tasks: FocusedReviewFanoutTask[];
  artifacts: Record<FocusedReviewAgent, string>;
}

export interface BuildFocusedReviewFanoutPlanParams {
  issueSlug: string;
  workflow: WorkflowType;
  taskCount: number;
}

export function shouldRunFocusedReviewFanout(taskCount: number): boolean {
  return taskCount >= FOCUSED_REVIEW_THRESHOLD;
}

export function buildFocusedReviewFanoutPlan(
  params: BuildFocusedReviewFanoutPlanParams,
): FocusedReviewFanoutPlan | null {
  if (!shouldRunFocusedReviewFanout(params.taskCount)) return null;

  const planDir = `.megapowers/plans/${params.issueSlug}`;
  const planningInput = `${planDir}/${params.workflow === "bugfix" ? "diagnosis.md" : "spec.md"}`;
  const tasksDir = `${planDir}/tasks/`;
  const artifacts: Record<FocusedReviewAgent, string> = {
    "coverage-reviewer": `${planDir}/coverage-review.md`,
    "dependency-reviewer": `${planDir}/dependency-review.md`,
    "task-quality-reviewer": `${planDir}/task-quality-review.md`,
  };

  return {
    runtime: "pi-subagents",
    mode: "parallel",
    artifacts,
    tasks: [
      {
        agent: "coverage-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["coverage-reviewer"]}.`,
          "You are advisory only; the main session keeps final approve/revise authority.",
        ].join("\n"),
      },
      {
        agent: "dependency-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["dependency-reviewer"]}.`,
          "Focus on ordering, forward references, hidden prerequisites, and sequencing hazards.",
        ].join("\n"),
      },
      {
        agent: "task-quality-reviewer",
        task: [
          `Review issue ${params.issueSlug}.`,
          `Read ${planningInput} and every task file under ${tasksDir}.`,
          `Write your bounded advisory artifact to ${artifacts["task-quality-reviewer"]}.`,
          "Focus on TDD completeness, realistic commands/errors, real file paths, correct APIs, and self-containment.",
        ].join("\n"),
      },
    ],
  };
}
