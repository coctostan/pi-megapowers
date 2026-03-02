import type { PlanTask } from "./state/state-machine.js";

export type { PlanTask };

/**
 * Strip fenced code blocks (``` ... ```) from markdown content.
 * Prevents the parser from matching task headers/items inside code examples.
 */
function stripFencedCodeBlocks(content: string): string {
  return content.replace(/^```[\s\S]*?^```/gm, "");
}

/**
 * Extract tasks from plan markdown.
 *
 * Supports two formats:
 * 1. `### Task N: Description` headers (preferred if present)
 * 2. Top-level numbered list items (`1. Description`)
 *
 * Content inside fenced code blocks is ignored.
 */
export function extractPlanTasks(planContent: string): PlanTask[] {
  const content = stripFencedCodeBlocks(planContent);

  // Try ### Task N: headers first
  const headerTasks = extractTaskHeaders(content);
  if (headerTasks.length > 0) return headerTasks;

  // Fall back to numbered list items
  return extractNumberedItems(content);
}

/**
 * Parse [depends: N, M, ...] annotation from a raw task string.
 * Returns the array of dependency indices, or undefined if not present.
 */
function parseDependsOn(raw: string): number[] | undefined {
  const match = raw.match(/\[depends:\s*([\d,\s]+)\]/i);
  if (!match) return undefined;
  return match[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}

/**
 * Strip [depends: ...] annotation from raw string.
 */
function stripDependsOn(raw: string): string {
  return raw.replace(/\s*\[depends:\s*[\d,\s]+\]\s*/gi, "");
}

/**
 * Strip all annotations ([no-test], [depends: ...]) and return clean description.
 */
function stripAnnotations(raw: string): string {
  return stripDependsOn(raw.replace(/\s*\[no-test\]\s*/gi, "")).trim();
}

/**
 * Build a PlanTask from raw task text and index number.
 */
function buildTask(index: number, raw: string): PlanTask {
  const noTest = /\[no-test\]/i.test(raw);
  const dependsOn = parseDependsOn(raw);
  const description = stripAnnotations(raw);
  const task: PlanTask = { index, description, completed: false, noTest };
  if (dependsOn) task.dependsOn = dependsOn;
  return task;
}

function extractTaskHeaders(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const pattern = /^#{2,3}\s+Task\s+(\d+)\s*[:—–-]\s*(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    tasks.push(buildTask(parseInt(match[1], 10), match[2].trim()));
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
      tasks.push(buildTask(parseInt(match[1]), match[2].trim()));
    }
  }

  return tasks;
}
