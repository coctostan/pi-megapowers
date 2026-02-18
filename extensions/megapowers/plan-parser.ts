import type { PlanTask } from "./state-machine.js";

export type { PlanTask };

/**
 * Extract tasks from plan markdown.
 *
 * Supports two formats:
 * 1. `### Task N: Description` headers (preferred if present)
 * 2. Top-level numbered list items (`1. Description`)
 */
export function extractPlanTasks(planContent: string): PlanTask[] {
  // Try ### Task N: headers first
  const headerTasks = extractTaskHeaders(planContent);
  if (headerTasks.length > 0) return headerTasks;

  // Fall back to numbered list items
  return extractNumberedItems(planContent);
}

function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const pattern = /^###\s+Task\s+(\d+):\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    tasks.push({
      index: parseInt(match[1]),
      description: match[2].trim(),
      completed: false,
    });
  }

  return tasks;
}

function extractNumberedItems(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match top-level numbered items (no leading whitespace beyond 0-1 spaces)
    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      tasks.push({
        index: parseInt(match[1]),
        description: match[2].trim(),
        completed: false,
      });
    }
  }

  return tasks;
}
