import { describe, it, expect } from "bun:test";
import {
  getPhasePromptTemplate,
  interpolatePrompt,
  PHASE_PROMPT_MAP,
} from "../extensions/megapowers/prompts.js";

describe("PHASE_PROMPT_MAP", () => {
  it("maps every feature phase to a prompt file", () => {
    const phases = ["brainstorm", "spec", "plan", "review", "implement", "verify", "done"];
    for (const phase of phases) {
      expect(PHASE_PROMPT_MAP[phase]).toBeDefined();
    }
  });

  it("maps every bugfix phase to a prompt file", () => {
    const phases = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"];
    for (const phase of phases) {
      expect(PHASE_PROMPT_MAP[phase]).toBeDefined();
    }
  });
});

describe("interpolatePrompt", () => {
  it("replaces {{key}} placeholders", () => {
    const template = "Working on {{issue_slug}} in phase {{phase}}.";
    const result = interpolatePrompt(template, {
      issue_slug: "001-auth",
      phase: "plan",
    });
    expect(result).toBe("Working on 001-auth in phase plan.");
  });

  it("leaves unknown placeholders as-is", () => {
    const result = interpolatePrompt("{{known}} and {{unknown}}", { known: "yes" });
    expect(result).toBe("yes and {{unknown}}");
  });

  it("handles empty vars", () => {
    const result = interpolatePrompt("Hello {{name}}", {});
    expect(result).toBe("Hello {{name}}");
  });
});

describe("getPhasePromptTemplate", () => {
  it("returns a non-empty string for brainstorm", () => {
    const template = getPhasePromptTemplate("brainstorm");
    expect(template.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for plan", () => {
    const template = getPhasePromptTemplate("plan");
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("{{spec_content}}");
  });
});
