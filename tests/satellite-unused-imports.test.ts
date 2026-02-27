import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("satellite.ts unused imports removed", () => {
  it("does not import readState, deriveTasks, canWrite, isTestFile, TddTaskState, or Type", () => {
    const source = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "satellite.ts"), "utf-8");
    expect(source).not.toContain("readState");
    expect(source).not.toContain("deriveTasks");
    expect(source).not.toContain("canWrite");
    expect(source).not.toContain("isTestFile");
    expect(source).not.toContain("TddTaskState");
    expect(source).not.toContain("@sinclair/typebox");
  });
});
