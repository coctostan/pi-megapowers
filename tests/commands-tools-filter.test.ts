import { describe, it, expect } from "bun:test";

describe("commands tool filtering", () => {
  it("/mega off/on tool lists mention pipeline and do not mention subagent_status", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(src).toContain('"pipeline"');
    expect(src).toContain('"subagent"');
    expect(src).not.toContain('"subagent_status"');
  });
});
