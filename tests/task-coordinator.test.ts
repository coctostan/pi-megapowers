import { describe, it, expect } from "bun:test";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
  shouldCreateTaskChange,
} from "../extensions/megapowers/task-coordinator.js";

describe("buildTaskChangeDescription", () => {
  it("formats description with issue slug and task number", () => {
    expect(buildTaskChangeDescription("001-auth-flow", 3, "Add retry logic")).toBe(
      "mega(001-auth-flow): task-3 — Add retry logic"
    );
  });

  it("formats description for task 1", () => {
    expect(buildTaskChangeDescription("002-fix-bug", 1, "Define types")).toBe(
      "mega(002-fix-bug): task-1 — Define types"
    );
  });
});

describe("parseTaskDiffFiles", () => {
  it("extracts file paths from jj diff --summary output", () => {
    const output = `M src/auth.ts\nA tests/auth.test.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("extracts file paths from jj diff --stat output", () => {
    const output = `src/auth.ts    | 10 ++++++----\ntests/auth.test.ts |  5 +++++\n2 files changed, 11 insertions(+), 4 deletions(-)`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("returns empty array for empty diff", () => {
    expect(parseTaskDiffFiles("")).toEqual([]);
  });

  it("returns empty array for summary-only line", () => {
    expect(parseTaskDiffFiles("0 files changed")).toEqual([]);
  });

  it("handles hypothetical rename/copy summary lines", () => {
    const output = `R src/old.ts => src/new.ts\nC src/original.ts => src/copy.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/old.ts => src/new.ts", "src/original.ts => src/copy.ts"]);
  });

  it("handles any single-letter status prefix", () => {
    const output = `X src/unknown-status.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/unknown-status.ts"]);
  });
});

describe("buildTaskCompletionReport", () => {
  it("builds a report listing files when diffs exist", () => {
    const report = buildTaskCompletionReport(3, "Add retry logic", {
      files: ["src/retry.ts", "tests/retry.test.ts"],
      hasDiffs: true,
    });
    expect(report).toContain("Task 3");
    expect(report).toContain("Add retry logic");
    expect(report).toContain("src/retry.ts");
    expect(report).toContain("2 files");
  });

  it("flags warning when no diffs", () => {
    const report = buildTaskCompletionReport(1, "Define types", {
      files: [],
      hasDiffs: false,
    });
    expect(report).toContain("⚠");
    expect(report).toContain("no file changes");
  });
});

describe("shouldCreateTaskChange", () => {
  it("returns true when in implement phase with active task and no existing change", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(true);
  });

  it("returns false when task already has a change ID", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: { 1: "existing-change" },
    })).toBe(false);
  });

  it("returns false when not in implement phase", () => {
    expect(shouldCreateTaskChange({
      phase: "plan",
      currentTaskIndex: 0,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when no tasks exist", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      planTasks: [],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when currentTaskIndex is out of bounds", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 5,
      planTasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });
});
