import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePlanTask, readPlanTask, listPlanTasks, writePlanSummary, readPlanSummary, writePlanReview, readPlanReview } from "../extensions/megapowers/plan-store.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "plan-store-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("writePlanTask", () => {
  it("writes a task file to the correct path with zero-padded ID", () => {
    const task = {
      data: { id: 3, title: "Test task", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "## Description\n\nTask body here.",
    };
    writePlanTask(tmp, "my-issue", task);

    const expectedPath = join(tmp, ".megapowers", "plans", "my-issue", "tasks", "task-03.md");
    expect(existsSync(expectedPath)).toBe(true);

    const written = readFileSync(expectedPath, "utf-8");
    expect(written).toContain("id: 3");
    expect(written).toContain("title: Test task");
    expect(written).toContain("## Description");
  });

  it("creates directories if they don't exist", () => {
    const task = {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Body",
    };
    // tmp has no .megapowers dir yet
    writePlanTask(tmp, "new-slug", task);
    const expectedPath = join(tmp, ".megapowers", "plans", "new-slug", "tasks", "task-01.md");
    expect(existsSync(expectedPath)).toBe(true);
  });


  it("does not modify other existing task files", () => {
    const task1 = {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First task body",
    };
    const task2 = {
      data: { id: 2, title: "Second", status: "approved" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Second task body",
    };

    writePlanTask(tmp, "iso-slug", task1);
    const task1Path = join(tmp, ".megapowers", "plans", "iso-slug", "tasks", "task-01.md");
    const beforeContent = readFileSync(task1Path, "utf-8");

    writePlanTask(tmp, "iso-slug", task2);

    const afterContent = readFileSync(task1Path, "utf-8");
    expect(afterContent).toBe(beforeContent);
  });

});


describe("readPlanTask", () => {
  it("reads back a written task", () => {
    const task = {
      data: { id: 2, title: "Read test", status: "approved" as const, depends_on: [1], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "## Details\n\nSome details.",
    };
    writePlanTask(tmp, "read-slug", task);

    const result = readPlanTask(tmp, "read-slug", 2);
    expect(result).not.toBeNull();
    expect(result!.data.id).toBe(2);
    expect(result!.data.title).toBe("Read test");
    expect(result!.data.status).toBe("approved");
    expect(result!.data.depends_on).toEqual([1]);
    expect(result!.content).toContain("## Details");
  });

  it("returns null when file does not exist", () => {
    const result = readPlanTask(tmp, "nonexistent", 99);
    expect(result).toBeNull();
  });
});


describe("listPlanTasks", () => {
  it("returns all tasks sorted by id", () => {
    // Write out of order
    writePlanTask(tmp, "list-slug", {
      data: { id: 3, title: "Third", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Third task",
    });
    writePlanTask(tmp, "list-slug", {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First task",
    });

    const tasks = listPlanTasks(tmp, "list-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if ("error" in tasks) throw new Error("unreachable");
    expect(tasks.length).toBe(2);
    expect(tasks[0].data.id).toBe(1);
    expect(tasks[1].data.id).toBe(3);
  });

  it("returns empty array when directory does not exist", () => {
    const tasks = listPlanTasks(tmp, "no-such-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if (!Array.isArray(tasks)) throw new Error("unreachable");
    expect(tasks.length).toBe(0);
  });

  it("handles ID gaps without error", () => {
    // task-01 and task-03 but no task-02
    writePlanTask(tmp, "gap-slug", {
      data: { id: 1, title: "One", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "One",
    });
    writePlanTask(tmp, "gap-slug", {
      data: { id: 3, title: "Three", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "Three",
    });

    const tasks = listPlanTasks(tmp, "gap-slug");
    expect(Array.isArray(tasks)).toBe(true);
    if (!Array.isArray(tasks)) throw new Error("unreachable");
    expect(tasks.length).toBe(2);
    expect(tasks[0].data.id).toBe(1);
    expect(tasks[1].data.id).toBe(3);
  });

  it("returns error when two files have the same task ID", () => {
    writePlanTask(tmp, "dup-slug", {
      data: { id: 1, title: "First", status: "draft" as const, depends_on: [], no_test: false, files_to_modify: [], files_to_create: [] },
      content: "First",
    });
    // Write a second file with a different filename but same ID in frontmatter
    // We need to write task-02.md but with id: 1 in frontmatter
    const dir = join(tmp, ".megapowers", "plans", "dup-slug", "tasks");
    writeFileSync(
      join(dir, "task-02.md"),
      "---\nid: 1\ntitle: Duplicate\nstatus: draft\n---\nBody",
      "utf-8",
    );

    const result = listPlanTasks(tmp, "dup-slug");
    expect(Array.isArray(result)).toBe(false);
    expect((result as any).error).toContain("Duplicate task ID");
  });
});


describe("writePlanSummary / readPlanSummary", () => {
  it("writes and reads back a plan summary", () => {
    const summary = {
      data: {
        type: "plan" as const,
        issue: "066-plan-review",
        status: "draft" as const,
        iteration: 1,
        task_count: 5,
      },
      content: "## Approach\n\nBuild the thing.",
    };
    writePlanSummary(tmp, "summary-slug", summary);
    const result = readPlanSummary(tmp, "summary-slug");

    expect(result).not.toBeNull();
    expect(result!.data.type).toBe("plan");
    expect(result!.data.issue).toBe("066-plan-review");
    expect(result!.data.iteration).toBe(1);
    expect(result!.content).toContain("## Approach");
  });

  it("returns null when plan.md does not exist", () => {
    const result = readPlanSummary(tmp, "no-summary");
    expect(result).toBeNull();
  });
});


describe("writePlanReview / readPlanReview", () => {
  it("writes and reads back a plan review", () => {
    const review = {
      data: {
        type: "plan-review" as const,
        iteration: 2,
        verdict: "revise" as const,
        reviewed_tasks: [1, 2, 3],
        approved_tasks: [1],
        needs_revision_tasks: [2, 3],
      },
      content: "## Summary\n\nNeeds work on tasks 2 and 3.",
    };
    writePlanReview(tmp, "review-slug", review);
    const result = readPlanReview(tmp, "review-slug");

    expect(result).not.toBeNull();
    expect(result!.data.type).toBe("plan-review");
    expect(result!.data.verdict).toBe("revise");
    expect(result!.data.approved_tasks).toEqual([1]);
    expect(result!.data.needs_revision_tasks).toEqual([2, 3]);
    expect(result!.content).toContain("## Summary");
  });

  it("returns null when review.md does not exist", () => {
    const result = readPlanReview(tmp, "no-review");
    expect(result).toBeNull();
  });
});
