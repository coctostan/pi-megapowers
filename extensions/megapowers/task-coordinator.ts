import type { PlanTask, Phase } from "./state-machine.js";

// --- Pure helpers ---

export function buildTaskChangeDescription(
  issueSlug: string,
  taskIndex: number,
  taskDescription: string
): string {
  return `mega(${issueSlug}): task-${taskIndex} — ${taskDescription}`;
}

/**
 * Parse file paths from jj diff output.
 * Supports --summary format ("M src/auth.ts") and --stat format ("src/auth.ts | 10 ++++").
 */
export function parseTaskDiffFiles(diffOutput: string): string[] {
  if (!diffOutput.trim()) return [];

  const files: string[] = [];
  for (const line of diffOutput.split("\n")) {
    // --summary format: "M src/auth.ts" or "A tests/auth.test.ts" or "D old.ts"
    const summaryMatch = line.match(/^[MAD]\s+(.+)$/);
    if (summaryMatch) {
      files.push(summaryMatch[1].trim());
      continue;
    }
    // --stat format: "src/auth.ts    | 10 ++++++----"
    const statMatch = line.match(/^(.+?)\s+\|\s+\d+/);
    if (statMatch) {
      files.push(statMatch[1].trim());
    }
  }
  return files;
}

export interface TaskInspection {
  files: string[];
  hasDiffs: boolean;
}

export function buildTaskCompletionReport(
  taskIndex: number,
  taskDescription: string,
  inspection: TaskInspection
): string {
  if (!inspection.hasDiffs) {
    return `⚠ Task ${taskIndex} (${taskDescription}) completed with no file changes.`;
  }
  const fileList = inspection.files.map((f) => `  - ${f}`).join("\n");
  return `Task ${taskIndex} (${taskDescription}) — ${inspection.files.length} files:\n${fileList}`;
}

export interface TaskChangeContext {
  phase: Phase | null;
  currentTaskIndex: number;
  planTasks: PlanTask[];
  taskJJChanges: Record<number, string>;
}

export function shouldCreateTaskChange(ctx: TaskChangeContext): boolean {
  if (ctx.phase !== "implement") return false;
  if (ctx.planTasks.length === 0) return false;
  const currentTask = ctx.planTasks[ctx.currentTaskIndex];
  if (!currentTask) return false;
  if (ctx.taskJJChanges[currentTask.index]) return false;
  return true;
}
