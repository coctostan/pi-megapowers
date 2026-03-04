import type { PlanTask } from "../state/state-machine.js";

export interface ValidationResult {
  valid: boolean;
  unmetDependencies?: number[];
  error?: string;
}

export function validateTaskDependencies(
  taskIndex: number,
  tasks: PlanTask[],
  completedTaskIndices: number[],
): ValidationResult {
  if (tasks.length === 0) {
    return { valid: false, error: "No tasks found. Ensure task files exist in .megapowers/plans/<issue>/tasks/." };
  }
  const task = tasks.find((t) => t.index === taskIndex);
  if (!task) {
    return { valid: false, error: `Task ${taskIndex} not found in plan.` };
  }
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { valid: true };
  }
  const completedSet = new Set(completedTaskIndices);
  const unmet = task.dependsOn.filter((dep) => !completedSet.has(dep));
  if (unmet.length > 0) {
    return { valid: false, unmetDependencies: unmet };
  }
  return { valid: true };
}
