import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/mp registration compatibility", () => {
  it("keeps existing standalone commands while adding /mp", () => {
    const source = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");

    expect(source).toContain('pi.registerCommand("mp"');

    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task", "review"]) {
      expect(source).toContain(`pi.registerCommand("${cmd}"`);
    }
  });
});
