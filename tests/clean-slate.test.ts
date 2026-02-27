import { describe, it, expect } from "bun:test";

describe("clean slate subagent replacement", () => {
  it("old subagent modules are not importable", async () => {
    const oldMods = [
      "../extensions/megapowers/subagent/subagent-async.js",
      "../extensions/megapowers/subagent/subagent-runner.js",
      "../extensions/megapowers/subagent/subagent-status.js",
      "../extensions/megapowers/subagent/subagent-tools.js",
      "../extensions/megapowers/subagent/subagent-validate.js",
    ];

    for (const m of oldMods) {
      let threw = false;
      try {
        await import(m);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    }
  });
});
