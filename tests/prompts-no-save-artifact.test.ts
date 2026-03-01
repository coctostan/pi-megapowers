import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("prompt templates", () => {
  it("do not reference megapowers_save_artifact anywhere (AC8/AC9)", () => {
    const promptsDir = join(process.cwd(), "prompts");
    const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(promptsDir, file), "utf8");
      expect(content).not.toContain("megapowers_save_artifact");
    }
  });
});
