import type { PlanTask } from "../state/plan-schemas.js";

const MIN_DESCRIPTION_LENGTH = 200;

export type LintTaskInput = PlanTask & { description: string };
export type LintResult = { pass: true } | { pass: false; errors: string[] };

export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
  const errors: string[] = [];

  if (!task.title || task.title.trim().length === 0) {
    errors.push("Title must not be empty or whitespace-only.");
  }

  // AC2: Description minimum length
  if (task.description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
  }
  // AC3: Must have at least one file target
  if (task.files_to_modify.length === 0 && task.files_to_create.length === 0) {
    errors.push("Task must specify at least one file in files_to_modify or files_to_create.");
  }

  // AC4: depends_on must reference existing task IDs
  // AC5: depends_on must not contain IDs >= current task ID
  if (task.depends_on.length > 0) {
    const existingIds = new Set(existingTasks.map((t) => t.id));
    for (const depId of task.depends_on) {
      if (depId >= task.id) {
        errors.push(`depends_on contains forward reference to task ${depId} (current task is ${task.id}).`);
      } else if (!existingIds.has(depId)) {
        errors.push(`depends_on references non-existent task ${depId}.`);
      }
    }
  }

  // AC6: files_to_create must not duplicate another task's files_to_create
  if (task.files_to_create.length > 0) {
    const claimedPaths = new Set<string>();
    for (const existing of existingTasks) {
      // Skip self during updates
      if (existing.id === task.id) continue;
      for (const filePath of existing.files_to_create) {
        claimedPaths.add(filePath);
      }
    }
    for (const filePath of task.files_to_create) {
      if (claimedPaths.has(filePath)) {
        errors.push(`files_to_create path "${filePath}" is already claimed by another task.`);
      }
    }
  }

  // AC9: Return all errors
  if (errors.length > 0) {
    return { pass: false, errors };
  }
  return { pass: true };
}
