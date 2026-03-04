import { describe, it, expect } from "bun:test";
import { parseStepResult, parseReviewVerdict, parseReviewOutput, type ImplementResult, type ReviewResult } from "../extensions/megapowers/subagent/pipeline-results.js";
import type { DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("parseStepResult", () => {
  it("extracts filesChanged/testsPassed/finalOutput from messages", () => {
    const dispatch: DispatchResult = {
      exitCode: 0,
      messages: [
        {
          role: "assistant" as const,
          content: [
            { type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts", content: "x" } },
            { type: "tool_use" as const, id: "2", name: "bash", input: { command: "bun test" } },
          ],
        },
        {
          role: "tool" as const,
          content: [{ type: "tool_result" as const, tool_use_id: "2", content: "1 pass\n0 fail" }],
        },
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "All done" }],
        },
      ] as any,
      filesChanged: [],
      testsPassed: null,
    };

    const r = parseStepResult(dispatch);
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.testsPassed).toBe(true);
    expect(r.finalOutput).toContain("All done");
  });
});

describe("parseReviewVerdict", () => {
  it("parses approve/reject and findings", () => {
    const v1 = parseReviewVerdict("Verdict: approve");
    expect(v1.verdict).toBe("approve");

    const v2 = parseReviewVerdict("Verdict: reject\n\n## Findings\n- Missing test\n- Bug");
    expect(v2.verdict).toBe("reject");
    expect(v2.findings).toEqual(["Missing test", "Bug"]);
  });
});

describe("ImplementResult", () => {
  it("satisfies the type contract with required and optional fields", () => {
    const result: ImplementResult = {
      filesChanged: ["src/a.ts", "tests/a.test.ts"],
      tddReport: {
        testWrittenFirst: true,
        testRanBeforeProduction: true,
        productionFilesBeforeTest: [],
        testRunCount: 2,
      },
    };
    expect(result.filesChanged).toEqual(["src/a.ts", "tests/a.test.ts"]);
    expect(result.tddReport.testWrittenFirst).toBe(true);
    expect(result.error).toBeUndefined();

    const withError: ImplementResult = {
      filesChanged: [],
      tddReport: {
        testWrittenFirst: false,
        testRanBeforeProduction: false,
        productionFilesBeforeTest: [],
        testRunCount: 0,
      },
      error: "Dispatch timed out",
    };
    expect(withError.error).toBe("Dispatch timed out");

    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/pipeline-results.ts"),
      "utf-8",
    );
    expect(source).toContain("export interface ImplementResult");
  });
});

describe("parseReviewOutput", () => {
  it("parses valid frontmatter with approve verdict and extracts findings from body", () => {
    const text = `---
verdict: approve
---

Good implementation.

- Clean code structure
- Tests cover edge cases`;

    const result: ReviewResult = parseReviewOutput(text);
    expect(result.verdict).toBe("approve");
    expect(result.findings).toEqual(["Clean code structure", "Tests cover edge cases"]);
    expect(result.raw).toBe(text);
  });

  it("parses valid frontmatter with reject verdict", () => {
    const text = `---
verdict: reject
---

Issues found:

- Missing error handling in parser
- No edge case coverage`;

    const result: ReviewResult = parseReviewOutput(text);
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Missing error handling in parser", "No edge case coverage"]);
    expect(result.raw).toBe(text);
  });
});


describe("parseReviewOutput empty output", () => {
  it("returns reject with a stable empty-output parse error finding", () => {
    const result = parseReviewOutput("\n\n");
    expect(result.verdict).toBe("reject");
    expect(result.findings).toEqual(["Review parse error: empty output"]);
  });
});