import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("tool-plan-review delegation", () => {
  it("delegates revise and approve flows to plan-orchestrator", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions", "megapowers", "tools", "tool-plan-review.ts"),
      "utf-8",
    );

    expect(source).toContain("transitionReviewToRevise");
    expect(source).toContain("approvePlan");
    expect(source).not.toContain("generateLegacyPlanMd(");
    expect(source).not.toContain('planMode: "revise"');
    expect(source).not.toContain('planIteration: state.planIteration + 1');
  });
});
