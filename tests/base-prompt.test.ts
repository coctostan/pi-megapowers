// tests/base-prompt.test.ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

describe("prompts/base.md (AC4)", () => {
  it("exists as a standalone template file", () => {
    const content = readFileSync(join(PROMPTS_DIR, "base.md"), "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("contains Getting Started section", () => {
    const content = readFileSync(join(PROMPTS_DIR, "base.md"), "utf-8");
    expect(content).toContain("Getting Started");
  });

  it("contains /issue command reference", () => {
    const content = readFileSync(join(PROMPTS_DIR, "base.md"), "utf-8");
    expect(content).toContain("/issue");
  });

  it("contains megapowers_signal tool reference", () => {
    const content = readFileSync(join(PROMPTS_DIR, "base.md"), "utf-8");
    expect(content).toContain("megapowers_signal");
  });

  it("contains megapowers_save_artifact tool reference", () => {
    const content = readFileSync(join(PROMPTS_DIR, "base.md"), "utf-8");
    expect(content).toContain("megapowers_save_artifact");
  });
});
