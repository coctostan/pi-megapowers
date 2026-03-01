import { describe, it, expect } from "bun:test";
import { PlanTaskSchema, PlanSummarySchema, PlanReviewSchema } from "../extensions/megapowers/plan-schemas.js";

describe("PlanTaskSchema", () => {
  it("validates a complete task with all fields", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Build entity parser",
      status: "draft",
      depends_on: [2, 3],
      no_test: true,
      files_to_modify: ["src/foo.ts"],
      files_to_create: ["src/bar.ts"],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.id).toBe(1);
    expect(result.data.status).toBe("draft");
  });

  it("applies defaults for optional fields", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Minimal task",
      status: "approved",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.depends_on).toEqual([]);
    expect(result.data.no_test).toBe(false);
    expect(result.data.files_to_modify).toEqual([]);
    expect(result.data.files_to_create).toEqual([]);
  });

  it("rejects invalid status values", () => {
    const result = PlanTaskSchema.safeParse({
      id: 1,
      title: "Bad status",
      status: "completed",
    });
    expect(result.success).toBe(false);
  });
});


describe("PlanSummarySchema", () => {
  it("validates a complete plan summary", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "066-plan-review-iterative-loop",
      status: "draft",
      iteration: 1,
      task_count: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.type).toBe("plan");
    expect(result.data.iteration).toBe(1);
  });

  it("rejects non-positive iteration", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "draft",
      iteration: 0,
      task_count: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative task_count", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "in_review",
      iteration: 1,
      task_count: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = PlanSummarySchema.safeParse({
      type: "plan",
      issue: "test",
      status: "rejected",
      iteration: 1,
      task_count: 0,
    });
    expect(result.success).toBe(false);
  });
});


describe("PlanReviewSchema", () => {
  it("validates a complete plan review", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "revise",
      reviewed_tasks: [1, 2, 3],
      approved_tasks: [1, 3],
      needs_revision_tasks: [2],
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.verdict).toBe("revise");
    expect(result.data.approved_tasks).toEqual([1, 3]);
  });

  it("rejects invalid verdict", () => {
    const result = PlanReviewSchema.safeParse({
      type: "plan-review",
      iteration: 1,
      verdict: "reject",
      reviewed_tasks: [],
      approved_tasks: [],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong type literal", () => {
    const result = PlanReviewSchema.safeParse({
      type: "review",
      iteration: 1,
      verdict: "approve",
      reviewed_tasks: [],
      approved_tasks: [],
      needs_revision_tasks: [],
    });
    expect(result.success).toBe(false);
  });
});
