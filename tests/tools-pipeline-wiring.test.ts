import { describe, it, expect } from "bun:test";

describe("pipeline tool wiring", () => {
  it("register-tools wires pipeline tool", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "register-tools.ts"), "utf-8");

    expect(src).toContain('name: "pipeline"');
  });
});
