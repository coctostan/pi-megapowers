import { describe, it, expect } from "bun:test";
import * as taskCoordinator from "../extensions/megapowers/task-coordinator.js";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
  createTaskChange,
  inspectTaskChange,
} from "../extensions/megapowers/task-coordinator.js";
import type { JJ } from "../extensions/megapowers/jj.js";

describe("dead exports", () => {
  it("does not export deprecated task change helpers", () => {
    expect(taskCoordinator.shouldCreateTaskChange).toBeUndefined();
    expect(taskCoordinator.abandonTaskChange).toBeUndefined();
    expect(taskCoordinator.squashTaskChanges).toBeUndefined();
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

describe("createTaskChange (AC19/AC20)", () => {
  function mockJJ(overrides: Partial<JJ> = {}): JJ {
    return {
      isJJRepo: async () => true,
      getCurrentChangeId: async () => "current-id",
      getChangeDescription: async () => "",
      hasConflicts: async () => false,
      newChange: async () => "new-id",
      describe: async () => {},
      squash: async () => {},
      bookmarkSet: async () => {},
      log: async () => "",
      diff: async () => "",
      abandon: async () => {},
      squashInto: async () => {},
      ...overrides,
    };
  }

  it("creates a new jj change with formatted description", async () => {
    let createdDesc: string | null = null;
    let createdParent: string | undefined;
    const jj = mockJJ({
      newChange: async (desc: string, parent?: string) => {
        createdDesc = desc;
        createdParent = parent;
        return "task-change-id";
      },
    });
    const result = await createTaskChange(jj, "001-auth", 3, "Add retry logic", "parent-change");
    expect(result.changeId).toBe("task-change-id");
    expect(createdDesc).toBe("mega(001-auth): task-3 — Add retry logic");
    expect(createdParent).toBe("parent-change");
  });

  it("returns null changeId when jj.newChange returns null", async () => {
    const jj = mockJJ({
      newChange: async () => null,
    });
    const result = await createTaskChange(jj, "001-auth", 1, "Setup");
    expect(result.changeId).toBeNull();
  });
});

describe("inspectTaskChange (AC20)", () => {
  function mockJJ(overrides: Partial<JJ> = {}): JJ {
    return {
      isJJRepo: async () => true,
      getCurrentChangeId: async () => "current-id",
      getChangeDescription: async () => "",
      hasConflicts: async () => false,
      newChange: async () => "new-id",
      describe: async () => {},
      squash: async () => {},
      bookmarkSet: async () => {},
      log: async () => "",
      diff: async () => "",
      abandon: async () => {},
      squashInto: async () => {},
      ...overrides,
    };
  }

  it("returns files and hasDiffs from jj diff output", async () => {
    const jj = mockJJ({
      diff: async () => "M src/auth.ts\nA tests/auth.test.ts",
    });
    const inspection = await inspectTaskChange(jj, "change-abc");
    expect(inspection.hasDiffs).toBe(true);
    expect(inspection.files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
  });

  it("returns hasDiffs=false for empty diff", async () => {
    const jj = mockJJ({ diff: async () => "" });
    const inspection = await inspectTaskChange(jj, "change-abc");
    expect(inspection.hasDiffs).toBe(false);
    expect(inspection.files).toEqual([]);
  });
});
