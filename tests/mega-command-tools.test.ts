import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/mega on|off tool lists", () => {
  it("commands.ts does not reference megapowers_save_artifact (AC3/AC4)", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/commands.ts"), "utf8");
    expect(source).not.toContain("megapowers_save_artifact");
  });
});
