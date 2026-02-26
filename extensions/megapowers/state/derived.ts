// extensions/megapowers/state/derived.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlanTasks } from "../plan-parser.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "../spec-parser.js";
import type { PlanTask, AcceptanceCriterion, WorkflowType } from "./state-machine.js";

/**
 * Parse tasks from plan.md on demand.
 * Returns empty array when plan.md is missing or has no tasks.
 */
export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  const planPath = join(cwd, ".megapowers", "plans", issueSlug, "plan.md");
  if (!existsSync(planPath)) return [];
  const content = readFileSync(planPath, "utf-8");
  return extractPlanTasks(content);
}

/**
 * Parse acceptance criteria from spec.md (feature) or diagnosis.md (bugfix) on demand.
 * Returns empty array when the source file is missing.
 */
export function deriveAcceptanceCriteria(
  cwd: string,
  issueSlug: string,
  workflow: WorkflowType,
): AcceptanceCriterion[] {
  const filename = workflow === "bugfix" ? "diagnosis.md" : "spec.md";
  const filePath = join(cwd, ".megapowers", "plans", issueSlug, filename);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return workflow === "bugfix"
    ? extractFixedWhenCriteria(content)
    : extractAcceptanceCriteria(content);
}
