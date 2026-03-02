import { describe, it, expect } from "bun:test";
import * as taskCoordinator from "../extensions/megapowers/task-coordinator.js";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
} from "../extensions/megapowers/task-coordinator.js";

describe("dead exports", () => {
  it("does not export deprecated task change helpers", () => {
    expect(taskCoordinator.shouldCreateTaskChange).toBeUndefined();
    expect(taskCoordinator.abandonTaskChange).toBeUndefined();
    expect(taskCoordinator.squashTaskChanges).toBeUndefined();
  });
});

describe("task-coordinator jj removals", () => {
  it("does not export createTaskChange or inspectTaskChange", () => {
    expect((taskCoordinator as any).createTaskChange).toBeUndefined();
    expect((taskCoordinator as any).inspectTaskChange).toBeUndefined();
  });
});

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
  it("extracts file paths from git diff --summary output", () => {
    const output = `M src/auth.ts\nA tests/auth.test.ts`;
    const files = parseTaskDiffFiles(output);
    expect(files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("extracts file paths from git diff --stat output", () => {
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

