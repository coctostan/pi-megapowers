import { describe, it, expect } from "bun:test";
import {
  buildTaskChangeDescription,
  parseTaskDiffFiles,
  buildTaskCompletionReport,
  shouldCreateTaskChange,
  squashTaskChanges,
  createTaskChange,
  inspectTaskChange,
} from "../extensions/megapowers/task-coordinator.js";
import type { JJ } from "../extensions/megapowers/jj.js";

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
      tasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(true);
  });

  it("returns false when task already has a change ID", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      tasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: { 1: "existing-change" },
    })).toBe(false);
  });

  it("returns false when not in implement phase", () => {
    expect(shouldCreateTaskChange({
      phase: "plan",
      currentTaskIndex: 0,
      tasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when no tasks exist", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 0,
      tasks: [],
      taskJJChanges: {},
    })).toBe(false);
  });

  it("returns false when currentTaskIndex is out of bounds", () => {
    expect(shouldCreateTaskChange({
      phase: "implement",
      currentTaskIndex: 5,
      tasks: [{ index: 1, description: "Do thing", completed: false, noTest: false }],
      taskJJChanges: {},
    })).toBe(false);
  });
});

describe("squashTaskChanges (AC21)", () => {
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

  it("calls jj.squashInto with the phase change ID", async () => {
    let squashedInto: string | null = null;
    const jj = mockJJ({
      squashInto: async (id: string) => { squashedInto = id; },
    });
    await squashTaskChanges(jj, "phase-change-abc");
    expect(squashedInto).toBe("phase-change-abc");
  });

  it("propagates errors from jj.squashInto", async () => {
    const jj = mockJJ({
      squashInto: async () => { throw new Error("squash failed"); },
    });
    expect(squashTaskChanges(jj, "phase-change-abc")).rejects.toThrow("squash failed");
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
