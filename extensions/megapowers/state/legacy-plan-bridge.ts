import type { EntityDoc } from "./entity-parser.js";
import type { PlanTask } from "./plan-schemas.js";

/**
 * Generate a backward-compatible plan.md from approved task files.
 * Output is parseable by extractPlanTasks() in plan-parser.ts.
 */
export function generateLegacyPlanMd(tasks: EntityDoc<PlanTask>[]): string {
  const lines: string[] = ["# Plan\n"];

  for (const task of tasks) {
    const tags: string[] = [];
    if (task.data.no_test) tags.push("[no-test]");
    if (task.data.depends_on.length > 0) {
      tags.push(`[depends: ${task.data.depends_on.join(", ")}]`);
    }

    const tagStr = tags.length > 0 ? ` ${tags.join(" ")}` : "";
    lines.push(`### Task ${task.data.id}: ${task.data.title}${tagStr}\n`);
    lines.push(task.content.trim());
    lines.push("");
  }

  return lines.join("\n");
}
