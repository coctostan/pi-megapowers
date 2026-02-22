import { describe, it, expect } from "bun:test";
import {
  interpolatePrompt,
  loadPromptFile,
  getPhasePromptTemplate,
  PHASE_PROMPT_MAP,
} from "../extensions/megapowers/prompts.js";

/**
 * Integration tests for bugfix prompt variable injection.
 *
 * These validate that bugfix templates, when interpolated with the variable
 * mapping that index.ts builds, produce correct output. This catches regressions
 * in the glue code between store → vars → template.
 */

describe("bugfix variable injection — plan phase aliasing", () => {
  it("write-plan.md interpolates correctly when bugfix aliases reproduce→brainstorm_content and diagnosis→spec_content", () => {
    const template = loadPromptFile("write-plan.md");
    expect(template).toBeTruthy();

    // Simulate the variable mapping index.ts builds for bugfix plan phase
    const vars: Record<string, string> = {
      issue_slug: "fix-parser-crash",
      phase: "plan",
      brainstorm_content: "Steps to reproduce: run parser with empty input",
      reproduce_content: "Steps to reproduce: run parser with empty input",
      spec_content: "Root cause: null check missing in parser.ts:42",
      diagnosis_content: "Root cause: null check missing in parser.ts:42",
    };

    const result = interpolatePrompt(template, vars);

    // Should contain the aliased reproduce content where brainstorm_content was
    expect(result).toContain("Steps to reproduce: run parser with empty input");
    // Should contain the aliased diagnosis content where spec_content was
    expect(result).toContain("Root cause: null check missing in parser.ts:42");
    // Should NOT have uninterpolated placeholders for these vars
    expect(result).not.toContain("{{brainstorm_content}}");
    expect(result).not.toContain("{{spec_content}}");
    expect(result).not.toContain("{{issue_slug}}");
  });
});

describe("bugfix variable injection — diagnose phase", () => {
  it("diagnose-bug.md interpolates reproduce_content and issue_slug", () => {
    const template = loadPromptFile("diagnose-bug.md");
    expect(template).toBeTruthy();

    const vars: Record<string, string> = {
      issue_slug: "fix-crash-on-empty",
      reproduce_content: "Bug: crash when input is empty string",
    };

    const result = interpolatePrompt(template, vars);

    expect(result).toContain("fix-crash-on-empty");
    expect(result).toContain("Bug: crash when input is empty string");
    expect(result).not.toContain("{{issue_slug}}");
    expect(result).not.toContain("{{reproduce_content}}");
  });
});

describe("bugfix variable injection — done phase with generate-bugfix-summary", () => {
  it("generate-bugfix-summary.md interpolates all 6 bugfix variables", () => {
    const template = loadPromptFile("generate-bugfix-summary.md");
    expect(template).toBeTruthy();

    const vars: Record<string, string> = {
      issue_slug: "fix-parser-crash",
      reproduce_content: "Steps to reproduce the crash",
      diagnosis_content: "Root cause identified",
      plan_content: "Plan to fix it",
      files_changed: "parser.ts\nparser.test.ts",
      learnings: "Always null-check inputs",
    };

    const result = interpolatePrompt(template, vars);

    expect(result).toContain("fix-parser-crash");
    expect(result).toContain("Steps to reproduce the crash");
    expect(result).toContain("Root cause identified");
    expect(result).toContain("Plan to fix it");
    expect(result).toContain("parser.ts\nparser.test.ts");
    expect(result).toContain("Always null-check inputs");
    // No uninterpolated placeholders
    expect(result).not.toContain("{{issue_slug}}");
    expect(result).not.toContain("{{reproduce_content}}");
    expect(result).not.toContain("{{diagnosis_content}}");
    expect(result).not.toContain("{{plan_content}}");
    expect(result).not.toContain("{{files_changed}}");
    expect(result).not.toContain("{{learnings}}");
  });
});

describe("bugfix variable injection — reproduce phase", () => {
  it("reproduce-bug.md interpolates issue_slug", () => {
    const template = loadPromptFile("reproduce-bug.md");
    expect(template).toBeTruthy();

    const vars: Record<string, string> = {
      issue_slug: "fix-off-by-one",
    };

    const result = interpolatePrompt(template, vars);

    expect(result).toContain("fix-off-by-one");
    expect(result).not.toContain("{{issue_slug}}");
  });
});
