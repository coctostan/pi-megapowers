import { describe, it, expect } from "bun:test";
import {
  extractFilesChanged,
  extractTestsPassed,
  extractFinalOutput,
  extractToolCalls,
  type ToolCallRecord,
} from "../extensions/megapowers/subagent/message-utils.js";

describe("extractFilesChanged", () => {
  it("extracts and deduplicates paths from write/edit tool calls", () => {
    const messages: any[] = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "1", name: "write", input: { path: "src/a.ts", content: "x" } },
          { type: "tool_use", id: "2", name: "edit", input: { path: "src/b.ts" } },
          { type: "tool_use", id: "3", name: "edit", input: { path: "src/a.ts" } },
        ],
      },
    ];

    expect(extractFilesChanged(messages)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("extractTestsPassed", () => {
  it("returns true when last matching test command output indicates 0 fails", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "t1", content: "5 pass\n0 fail" }] },
    ];
    expect(extractTestsPassed(messages)).toBe(true);
  });

  it("returns false when a matching test command output indicates failures", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "t1", content: "3 pass\n2 fail" }] },
    ];
    expect(extractTestsPassed(messages)).toBe(false);
  });

  it("returns null when no matching test command is present", () => {
    const messages: any[] = [{ role: "assistant", content: [{ type: "text", text: "done" }] }];
    expect(extractTestsPassed(messages)).toBe(null);
  });
});

describe("extractFinalOutput", () => {
  it("concatenates assistant text blocks", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "text", text: "First" }] },
      { role: "assistant", content: [{ type: "text", text: "Second" }] },
    ];
    expect(extractFinalOutput(messages)).toContain("First");
    expect(extractFinalOutput(messages)).toContain("Second");
  });
});

describe("extractToolCalls", () => {
  it("produces ordered ToolCallRecord list including bash outputs", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "1", name: "write", input: { path: "tests/a.test.ts" } }] },
      { role: "assistant", content: [{ type: "tool_use", id: "2", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "2", content: "1 fail" }] },
    ];

    const calls = extractToolCalls(messages);
    expect(calls).toEqual([
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
    ] satisfies ToolCallRecord[]);
  });
});
