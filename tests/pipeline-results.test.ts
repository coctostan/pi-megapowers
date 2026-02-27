import { describe, it, expect } from "bun:test";
import { parseStepResult, parseReviewVerdict } from "../extensions/megapowers/subagent/pipeline-results.js";
import type { DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

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
