import { describe, it, expect } from "bun:test";
import {
  extractTaskSection,
  buildSubagentPrompt,
} from "../extensions/megapowers/subagent/subagent-context.js";

describe("extractTaskSection", () => {
  const plan = `# Implementation Plan

### Task 1: Set up types

Create type definitions in \`src/types.ts\`.

### Task 2: Build parser [depends: 1]

Implement the parser in \`src/parser.ts\`.
Test file: \`tests/parser.test.ts\`.

### Task 3: Integration [depends: 1, 2]

Wire everything together.
`;

  it("extracts full section for task 1", () => {
    const section = extractTaskSection(plan, 1);
    expect(section).toContain("Set up types");
    expect(section).toContain("src/types.ts");
    expect(section).not.toContain("Build parser");
  });

  it("extracts full section for task 2", () => {
    const section = extractTaskSection(plan, 2);
    expect(section).toContain("Build parser");
    expect(section).toContain("src/parser.ts");
    expect(section).toContain("tests/parser.test.ts");
    expect(section).not.toContain("Wire everything");
  });

  it("extracts last task section", () => {
    const section = extractTaskSection(plan, 3);
    expect(section).toContain("Wire everything");
  });

  it("returns empty string for nonexistent task", () => {
    expect(extractTaskSection(plan, 99)).toBe("");
  });

  it("extracts from numbered list format", () => {
    const numberedPlan = `# Plan\n\n1. Do A\n\nDetails for A.\n\n2. Do B\n\nDetails for B.\n`;
    const section = extractTaskSection(numberedPlan, 1);
    expect(section).toContain("Do A");
    expect(section).toContain("Details for A");
  });
});

describe("buildSubagentPrompt", () => {
  it("includes task description in prompt", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build the auth module",
    });
    expect(prompt).toContain("Build the auth module");
  });

  it("includes plan section when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
      planSection: "### Task 2: Build parser\n\nImplement in src/parser.ts.",
    });
    expect(prompt).toContain("src/parser.ts");
  });

  it("includes learnings when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Do thing",
      learnings: "- Always check for null",
    });
    expect(prompt).toContain("Always check for null");
  });
});

describe("buildSubagentPrompt phase context", () => {
  it("includes phase name when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
      phase: "implement",
    });
    expect(prompt).toContain("implement");
    expect(prompt).toContain("Phase");
  });

  it("omits phase section when not provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
    });
    expect(prompt).not.toContain("Current Phase");
  });
});

describe("buildSubagentPrompt spec content", () => {
  it("includes spec content when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Verify feature",
      phase: "verify",
      specContent: "1. User can log in\n2. Session persists",
    });
    expect(prompt).toContain("User can log in");
    expect(prompt).toContain("Session persists");
    expect(prompt).toContain("Acceptance Criteria");
  });

  it("omits spec section when not provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build thing",
      phase: "implement",
    });
    expect(prompt).not.toContain("Acceptance Criteria");
  });
});
