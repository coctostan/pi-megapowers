import { describe, it, expect } from "bun:test";

describe("commands tool filtering", () => {
  it("/mega off/on only toggles megapowers_signal after legacy tool removal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(src).not.toContain('"pipeline"');
    expect(src).not.toContain('"subagent"');
    expect(src).toContain('t !== "megapowers_signal"');
    expect(src).toContain('const toolsToAdd = ["megapowers_signal"]');
  });
});
