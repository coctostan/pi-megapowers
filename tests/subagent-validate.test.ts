import { describe, it, expect } from "bun:test";
import { validateTaskDependencies, type ValidationResult } from "../extensions/megapowers/subagent/subagent-validate.js";
import type { PlanTask } from "../extensions/megapowers/state/state-machine.js";

describe("validateTaskDependencies", () => {
  const tasks: PlanTask[] = [
    { index: 1, description: "Types", completed: false, noTest: false },
    { index: 2, description: "Parser", completed: false, noTest: false, dependsOn: [1] },
    { index: 3, description: "Integration", completed: false, noTest: false, dependsOn: [1, 2] },
    { index: 4, description: "Docs", completed: false, noTest: true },
  ];

  it("allows task with no dependencies", () => {
    const result = validateTaskDependencies(1, tasks, []);
    expect(result.valid).toBe(true);
  });

  it("allows task when all dependencies are completed", () => {
    const result = validateTaskDependencies(2, tasks, [1]);
    expect(result.valid).toBe(true);
  });

  it("blocks task when dependencies are not completed", () => {
    const result = validateTaskDependencies(2, tasks, []);
    expect(result.valid).toBe(false);
    expect(result.unmetDependencies).toEqual([1]);
  });

  it("blocks task when some dependencies are not completed", () => {
    const result = validateTaskDependencies(3, tasks, [1]);
    expect(result.valid).toBe(false);
    expect(result.unmetDependencies).toEqual([2]);
  });

  it("allows task with no dependsOn field", () => {
    const result = validateTaskDependencies(4, tasks, []);
    expect(result.valid).toBe(true);
  });

  it("returns error for unknown task index", () => {
    const result = validateTaskDependencies(99, tasks, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when tasks array is empty", () => {
    const result = validateTaskDependencies(1, [], []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No tasks");
  });
});
