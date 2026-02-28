import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  appendStepOutput,
  setRetryContext,
  renderContextPrompt,
} from "../extensions/megapowers/subagent/pipeline-context.js";

describe("pipeline context", () => {
  it("builds initial context and appends step outputs", () => {
    let ctx = buildInitialContext({
      taskDescription: "Implement parser",
      planSection: "### Task 1: Parser",
      specContent: "AC1: ...",
      learnings: "Use bun test",
    });

    ctx = appendStepOutput(ctx, { step: "implement", filesChanged: ["src/a.ts"], finalOutput: "done" });
    ctx = setRetryContext(ctx, "Tests failed", "Fix null check");

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Tests failed");
    expect(prompt).toContain("Fix null check");
  });

  it("accumulates review findings across multiple retries (AC12)", () => {
    let ctx = buildInitialContext({ taskDescription: "x" });

    ctx = setRetryContext(ctx, "Cycle 0 failed", "Missing error handling");
    ctx = setRetryContext(ctx, "Cycle 1 failed", "Off-by-one in loop");

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Missing error handling");
    expect(prompt).toContain("Off-by-one in loop");
  });
});
