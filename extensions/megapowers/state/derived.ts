// extensions/megapowers/state/derived.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlanTasks } from "../plan-parser.js";
import { extractAcceptanceCriteria, extractFixedWhenCriteria } from "../spec-parser.js";
import type { PlanTask, AcceptanceCriterion, WorkflowType } from "./state-machine.js";
import { listPlanTasks } from "./plan-store.js";
import { getWorkflowConfig } from "../workflows/registry.js";
/**
 * Derive tasks from plan store (task files) or fall back to plan.md parsing.
 * Task files are the canonical source in the new plan system.
 * Returns empty array when no tasks are found from either source.
 */
export function deriveTasks(cwd: string, issueSlug: string): PlanTask[] {
  const taskDocs = listPlanTasks(cwd, issueSlug);
  if (taskDocs.length > 0) {
    return taskDocs.map((doc) => ({
      index: doc.data.id,
      description: doc.data.title,
      completed: false,
      noTest: doc.data.no_test ?? false,
      dependsOn: doc.data.depends_on?.length ? doc.data.depends_on : undefined,
    }));
  }
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
  const config = getWorkflowConfig(workflow);
  // If "diagnosis" is aliased to "spec", use diagnosis.md with Fixed When extraction
  const usesDiagnosisAlias = config.phaseAliases?.["diagnosis"] === "spec";
  const filename = usesDiagnosisAlias ? "diagnosis.md" : "spec.md";
  const filePath = join(cwd, ".megapowers", "plans", issueSlug, filename);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return usesDiagnosisAlias
    ? extractFixedWhenCriteria(content)
    : extractAcceptanceCriteria(content);
}
