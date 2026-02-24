// tests/prompt-content.test.ts
// Verifies prompt template content for AC8 (write-plan.md) and AC9 (implement-task.md)
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

describe("write-plan.md (AC8)", () => {
  it("contains [no-test] annotation guidance for type-only tasks", () => {
    const content = readFileSync(join(PROMPTS_DIR, "write-plan.md"), "utf-8");
    expect(content).toContain("[no-test]");
    expect(content).toContain("Type-only tasks");
  });
});

describe("implement-task.md (AC9)", () => {
  it("contains /tdd skip guidance", () => {
    const content = readFileSync(join(PROMPTS_DIR, "implement-task.md"), "utf-8");
    expect(content).toContain("/tdd skip");
  });

  it("contains Type-Only Tasks section", () => {
    const content = readFileSync(join(PROMPTS_DIR, "implement-task.md"), "utf-8");
    expect(content).toContain("Type-Only Tasks");
  });
});
