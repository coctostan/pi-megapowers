import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  withRetryContext,
  renderContextPrompt,
  type BoundedPipelineContext,
} from "../extensions/megapowers/subagent/pipeline-context-bounded.js";

describe("pipeline context (bounded)", () => {
  it("builds initial context without retry data", () => {
    const ctx = buildInitialContext({
      taskDescription: "Implement parser",
      planSection: "### Task 1: Parser",
      specContent: "AC1: parse input",
      learnings: "Use bun test",
    });

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).not.toContain("Retry");
  });

  it("withRetryContext adds bounded failure data that replaces on each call", () => {
    let ctx = buildInitialContext({ taskDescription: "x" });

    ctx = withRetryContext(ctx, {
      reason: "verify_failed",
      detail: "1 fail\nExpected true to be false at line 12",
    });

    let prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("verify_failed");
    expect(prompt).toContain("Expected true to be false");

    // Second retry REPLACES (not accumulates)
    ctx = withRetryContext(ctx, {
      reason: "review_rejected",
      detail: "Missing error handling",
    });

    prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("review_rejected");
    expect(prompt).toContain("Missing error handling");
    // Old retry data is gone
    expect(prompt).not.toContain("Expected true to be false");
  });

  it("context size is O(1) — does not grow with repeated retries", () => {
    let ctx = buildInitialContext({
      taskDescription: "Implement feature",
      planSection: "### Task 1",
      specContent: "AC1: do thing",
    });

    const baseSize = renderContextPrompt(ctx).length;

    // Simulate 10 retries
    for (let i = 0; i < 10; i++) {
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: `Failure output for cycle ${i}`,
      });
    }

    const finalSize = renderContextPrompt(ctx).length;
    // Should be base + one retry section, not base + 10 retry sections
    expect(finalSize).toBeLessThan(baseSize + 500);
  });
});
