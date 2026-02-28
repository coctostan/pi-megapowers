import { describe, it, expect } from "bun:test";
import { extractTestOutput } from "../extensions/megapowers/subagent/message-utils.js";

describe("extractTestOutput", () => {
  it("extracts raw tool_result output for the last bash test command", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "t", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "t", content: "0 pass\n1 fail\nERROR: boom" }] },
    ];

    expect(extractTestOutput(messages)).toContain("ERROR: boom");
  });

  it("returns null when there is no bash test command", () => {
    const messages: any[] = [{ role: "assistant", content: [{ type: "text", text: "done" }] }];
    expect(extractTestOutput(messages)).toBe(null);
  });
});
