import { describe, it, expect } from "bun:test";
import { generateLegacyPlanMd } from "../extensions/megapowers/state/legacy-plan-bridge.js";
import { extractPlanTasks } from "../extensions/megapowers/plan-parser.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function makeTask(id: number, title: string, opts?: Partial<PlanTask>): EntityDoc<PlanTask> {
  return {
    data: {
      id,
      title,
      status: "approved",
      depends_on: opts?.depends_on ?? [],
      no_test: opts?.no_test ?? false,
      files_to_modify: opts?.files_to_modify ?? [],
      files_to_create: opts?.files_to_create ?? [],
    },
    content: `Implementation details for task ${id}.`,
  };
}

describe("generateLegacyPlanMd", () => {
  it("generates plan.md with ### Task N: Title headers", () => {
    const tasks = [makeTask(1, "First"), makeTask(2, "Second")];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("### Task 1: First");
    expect(md).toContain("### Task 2: Second");
    expect(md).toContain("Implementation details for task 1.");
    expect(md).toContain("Implementation details for task 2.");
  });

  it("includes [no-test] annotation", () => {
    const tasks = [makeTask(1, "Config change", { no_test: true })];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("[no-test]");
  });

  it("includes [depends: N, M] annotation", () => {
    const tasks = [makeTask(1, "Base"), makeTask(2, "Depends", { depends_on: [1] })];
    const md = generateLegacyPlanMd(tasks);
    expect(md).toContain("[depends: 1]");
  });

  it("is parseable by extractPlanTasks (backward compat)", () => {
    const tasks = [
      makeTask(1, "First task"),
      makeTask(2, "Second task", { depends_on: [1] }),
      makeTask(3, "Config only", { no_test: true }),
    ];
    const md = generateLegacyPlanMd(tasks);
    const parsed = extractPlanTasks(md);

    expect(parsed.length).toBe(3);
    expect(parsed[0].index).toBe(1);
    expect(parsed[0].description).toBe("First task");
    expect(parsed[1].dependsOn).toEqual([1]);
    expect(parsed[2].noTest).toBe(true);
  });

  it("handles empty task list", () => {
    const md = generateLegacyPlanMd([]);
    expect(md).toContain("# Plan");
  });
});
