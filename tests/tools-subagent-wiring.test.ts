import { describe, it, expect } from "bun:test";

describe("subagent tool wiring", () => {
  it("register-tools wires subagent and does not wire subagent_status", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "register-tools.ts"), "utf-8");

    expect(src).toContain('name: "subagent"');
    expect(src).not.toContain('name: "subagent_status"');
  });
});
