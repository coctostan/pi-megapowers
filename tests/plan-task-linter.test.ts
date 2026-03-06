import { describe, it, expect } from "bun:test";
import { lintTask, type LintTaskInput } from "../extensions/megapowers/validation/plan-task-linter.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 1,
    title: "Valid task title",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}

describe("lintTask — title validation", () => {
  it("passes for a valid task", () => {
    const result = lintTask(makeLintTask(), []);
    expect(result).toEqual({ pass: true });
  });

  it("fails when title is empty string", () => {
    const result = lintTask(makeLintTask({ title: "" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.toLowerCase().includes("title"))).toBe(true);
    }
  });

  it("fails when title is whitespace only", () => {
    const result = lintTask(makeLintTask({ title: "   \t\n  " }), []);
    expect(result.pass).toBe(false);
  });

  it("returns all errors, not just the first", () => {
    const result = lintTask(makeLintTask({
      title: "",
      files_to_modify: [],
      files_to_create: [],
    }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("lintTask — description length", () => {
  it("fails when description is shorter than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "Short desc" }), []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("Description must be at least 200 characters (got 10).");
    }
  });

  it("passes when description is exactly 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(200) }), []);
    expect(result).toEqual({ pass: true });
  });

  it("passes when description is longer than 200 characters", () => {
    const result = lintTask(makeLintTask({ description: "A".repeat(300) }), []);
    expect(result).toEqual({ pass: true });
  });
});

describe("lintTask — depends_on validation", () => {
  const existingTasks: PlanTask[] = [
    { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: ["a.ts"], files_to_create: [] },
    { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: ["b.ts"], files_to_create: [] },
  ];

  function makeDepTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
    return {
      id: 3,
      title: "Third",
      status: "draft",
      depends_on: [],
      no_test: false,
      files_to_modify: ["c.ts"],
      files_to_create: [],
      description: "A".repeat(200),
      ...overrides,
    };
  }

  it("fails when depends_on has a forward reference (depId >= current task id)", () => {
    const task = makeDepTask({ depends_on: [99] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 99 (current task is 3).");
    }
  });

  it("fails when depends_on references a non-existent earlier task ID", () => {
    const task = makeDepTask({ id: 3, depends_on: [1] });
    const result = lintTask(task, []);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on references non-existent task 1.");
    }
  });

  it("fails on self-reference (depId === current task id)", () => {
    const task = makeDepTask({ depends_on: [3] });
    const result = lintTask(task, existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain("depends_on contains forward reference to task 3 (current task is 3).");
    }
  });

  it("passes when depends_on references only existing lower IDs", () => {
    const task = makeDepTask({ depends_on: [1, 2] });
    const result = lintTask(task, existingTasks);
    expect(result).toEqual({ pass: true });
  });
});

describe("lintTask — duplicate files_to_create", () => {
  function makeDupTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
    return {
      id: 2,
      title: "Second",
      status: "draft",
      depends_on: [1],
      no_test: false,
      files_to_modify: [],
      files_to_create: ["src/new-module.ts"],
      description: "A".repeat(200),
      ...overrides,
    };
  }

  it("fails when files_to_create overlaps another task's files_to_create", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeDupTask(), existingTasks);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors).toContain('files_to_create path "src/new-module.ts" is already claimed by another task.');
    }
  });

  it("passes when files_to_create has no overlap", () => {
    const existingTasks: PlanTask[] = [
      { id: 1, title: "First", status: "draft", depends_on: [], no_test: false, files_to_modify: [], files_to_create: ["src/a.ts"] },
    ];

    const result = lintTask(makeDupTask({ files_to_create: ["src/b.ts"] }), existingTasks);
    expect(result).toEqual({ pass: true });
  });

  it("allows update of the same task without self-conflict", () => {
    const existingTasks: PlanTask[] = [
      { id: 2, title: "Second", status: "draft", depends_on: [1], no_test: false, files_to_modify: [], files_to_create: ["src/new-module.ts"] },
    ];

    const result = lintTask(makeDupTask({ id: 2, depends_on: [] }), existingTasks);
    expect(result).toEqual({ pass: true });
  });
});