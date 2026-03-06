import { describe, it, expect } from "bun:test";
import { lintPlanWithModel, buildLintPrompt, type CompleteFn } from "../extensions/megapowers/validation/plan-lint-model.js";

const VALID_PASS_RESPONSE = JSON.stringify({ verdict: "pass", findings: [] });
const VALID_FAIL_RESPONSE = JSON.stringify({
  verdict: "fail",
  findings: [
    "AC3 is not covered by any task",
    "Task 2 description is vague — says 'handle edge cases' without specifying which",
  ],
});

function mockCompleteFn(responseText: string): CompleteFn {
  return async (_prompt: string) => responseText;
}

describe("lintPlanWithModel", () => {
  const tasks = [
    { id: 1, title: "First task", description: "Detailed description...", files: ["a.ts"] },
  ];
  const specContent = "## Acceptance Criteria\n1. Feature works\n2. Tests pass";

  it("returns pass when model says pass", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn(VALID_PASS_RESPONSE));
    expect(result.pass).toBe(true);
  });

  it("returns fail with findings when model finds issues", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn(VALID_FAIL_RESPONSE));
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain("AC3");
    }
  });

  it("treats malformed response as pass with warning (fail-open)", async () => {
    const result = await lintPlanWithModel(tasks, specContent, mockCompleteFn("This is not JSON at all"));
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("malformed");
    }
  });

  it("treats API error as pass with warning (fail-open)", async () => {
    const errorFn: CompleteFn = async () => { throw new Error("API timeout"); };
    const result = await lintPlanWithModel(tasks, specContent, errorFn);
    expect(result.pass).toBe(true);
    if (result.pass) {
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("API");
    }
  });
});

describe("buildLintPrompt — content assembly", () => {
  it("includes spec content in the prompt", () => {
    const spec = "## Acceptance Criteria\n1. Widget renders correctly\n2. Error state shows message";
    const tasks = [
      { id: 1, title: "Add widget", description: "Implement the widget component", files: ["src/widget.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, spec);
    expect(prompt.includes("Widget renders correctly")).toBe(true);
    expect(prompt.includes("Error state shows message")).toBe(true);
  });

  it("includes all task titles and descriptions in the prompt", () => {
    const tasks = [
      { id: 1, title: "Add parser", description: "Parse input data", files: ["src/parser.ts"] },
      { id: 2, title: "Add validator", description: "Validate parsed output", files: ["src/validator.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, "spec");
    expect(prompt.includes("Add parser")).toBe(true);
    expect(prompt.includes("Parse input data")).toBe(true);
    expect(prompt.includes("Add validator")).toBe(true);
    expect(prompt.includes("Validate parsed output")).toBe(true);
  });

  it("includes task file paths in the prompt", () => {
    const tasks = [
      { id: 1, title: "Task", description: "Desc", files: ["src/foo.ts", "src/bar.ts"] },
    ];
    const prompt = buildLintPrompt(tasks, "spec");
    expect(prompt.includes("src/foo.ts")).toBe(true);
    expect(prompt.includes("src/bar.ts")).toBe(true);
  });

  it("includes the lint-plan-prompt.md template content", () => {
    const tasks = [{ id: 1, title: "T", description: "D", files: ["a.ts"] }];
    const prompt = buildLintPrompt(tasks, "spec");
    // The prompt should include the checks from lint-plan-prompt.md
    expect(prompt.includes("Spec coverage")).toBe(true);
    expect(prompt.includes("Dependency coherence")).toBe(true);
    expect(prompt.includes("Description quality")).toBe(true);
    expect(prompt.includes("verdict")).toBe(true);
  });
});
