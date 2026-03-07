import { describe, it, expect } from "bun:test";
import {
  FOCUSED_REVIEW_AGENTS,
  FOCUSED_REVIEW_THRESHOLD,
  buildFocusedReviewFanoutPlan,
  shouldRunFocusedReviewFanout,
} from "../extensions/megapowers/plan-review/focused-review.js";

describe("focused review fan-out plan", () => {
  it("returns false and no plan when the task count is below the threshold", () => {
    expect(FOCUSED_REVIEW_THRESHOLD).toBe(5);
    expect(shouldRunFocusedReviewFanout(0)).toBe(false);
    expect(shouldRunFocusedReviewFanout(4)).toBe(false);
    expect(
      buildFocusedReviewFanoutPlan({
        issueSlug: "001-test",
        workflow: "feature",
        taskCount: 4,
      }),
    ).toBeNull();
  });

  it("returns a pi-subagents parallel plan with the exact three reviewer names at five tasks", () => {
    const plan = buildFocusedReviewFanoutPlan({
      issueSlug: "001-test",
      workflow: "feature",
      taskCount: 5,
    });

    expect(plan).not.toBeNull();
    expect(FOCUSED_REVIEW_AGENTS).toEqual([
      "coverage-reviewer",
      "dependency-reviewer",
      "task-quality-reviewer",
    ]);
    expect(plan?.runtime).toBe("pi-subagents");
    expect(plan?.mode).toBe("parallel");
    expect(plan?.tasks.map((task) => task.agent)).toEqual([...FOCUSED_REVIEW_AGENTS]);
    expect(plan?.artifacts).toEqual({
      "coverage-reviewer": ".megapowers/plans/001-test/coverage-review.md",
      "dependency-reviewer": ".megapowers/plans/001-test/dependency-review.md",
      "task-quality-reviewer": ".megapowers/plans/001-test/task-quality-review.md",
    });
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-test/spec.md");
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-test/tasks/");
    expect(plan?.tasks[1]?.task).toContain("dependency-review.md");
    expect(plan?.tasks[2]?.task).toContain("task-quality-review.md");
  });

  it("uses diagnosis.md instead of spec.md for bugfix workflows", () => {
    const plan = buildFocusedReviewFanoutPlan({
      issueSlug: "001-bug",
      workflow: "bugfix",
      taskCount: 6,
    });

    expect(plan).not.toBeNull();
    expect(plan?.tasks[0]?.task).toContain(".megapowers/plans/001-bug/diagnosis.md");
    expect(plan?.tasks[0]?.task).not.toContain(".megapowers/plans/001-bug/spec.md");
  });
});
