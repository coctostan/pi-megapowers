import { describe, it, expect } from "bun:test";
import { validateTaskDependencies } from "../extensions/megapowers/subagent/task-deps.js";
import type { PlanTask } from "../extensions/megapowers/state/state-machine.js";

describe("validateTaskDependencies", () => {
  it("returns valid when task has no dependencies", () => {
    const tasks: PlanTask[] = [{ index: 1, description: "x" } as any];
    expect(validateTaskDependencies(1, tasks, [])).toEqual({ valid: true });
  });

  it("returns unmetDependencies when deps incomplete", () => {
    const tasks: PlanTask[] = [{ index: 2, description: "x", dependsOn: [1, 3] } as any];
    const r = validateTaskDependencies(2, tasks, [1]);
    expect(r.valid).toBe(false);
    expect(r.unmetDependencies).toEqual([3]);
  });

  it("returns error when task missing", () => {
    const tasks: PlanTask[] = [{ index: 1, description: "x" } as any];
    const r = validateTaskDependencies(2, tasks, []);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("not found");
  });

  it("error message for empty tasks references task files, not plan.md", () => {
    const r = validateTaskDependencies(1, [], []);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("task file");
    expect(r.error).not.toContain("plan.md");
  });
});
