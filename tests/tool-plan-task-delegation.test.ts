import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-task delegation", () => {
  it("uses validatePlanTaskMutation instead of inline planMode checks", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-task.ts"),
      "utf-8",
    );

    expect(source).toContain("validatePlanTaskMutation");
    expect(source).not.toContain('state.planMode === "review"');
    expect(source).not.toContain('state.planMode !== "draft" && state.planMode !== "revise"');
  });
});
