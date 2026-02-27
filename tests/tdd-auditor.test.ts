import { describe, it, expect } from "bun:test";
import { auditTddCompliance, type ToolCallRecord } from "../extensions/megapowers/subagent/tdd-auditor.js";

describe("auditTddCompliance", () => {
  it("reports compliant order: test write -> test run -> prod write -> test run", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
      { tool: "edit", args: { path: "src/a.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 pass\n0 fail" },
    ];
    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.testRanBeforeProduction).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
    expect(r.testRunCount).toBe(2);
  });

  it("detects production .ts written before any test file", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "src/a.ts" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "0 fail" },
    ];
    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(false);
    expect(r.productionFilesBeforeTest).toEqual(["src/a.ts"]);
  });

  it("excludes config files from ordering checks", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "package.json" } },
      { tool: "write", args: { path: "tsconfig.json" } },
      { tool: "write", args: { path: ".gitignore" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "edit", args: { path: "src/a.ts" } },
    ];
    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
  });

  it("only treats .ts/.js as production files", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "README.md" } },
      { tool: "write", args: { path: "src/a.ts" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
    ];
    const r = auditTddCompliance(calls);
    expect(r.productionFilesBeforeTest).toEqual(["src/a.ts"]);
  });

  it("returns clean report for empty input", () => {
    const r = auditTddCompliance([]);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.testRanBeforeProduction).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
    expect(r.testRunCount).toBe(0);
  });
});
