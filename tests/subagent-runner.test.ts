import { describe, it, expect } from "bun:test";
import {
  generateSubagentId,
  buildSpawnArgs,
  buildSpawnEnv,
  processJsonlLine,
  type RunnerState,
  createRunnerState,
} from "../extensions/megapowers/subagent-runner.js";

describe("generateSubagentId", () => {
  it("returns a string starting with 'sa-'", () => {
    const id = generateSubagentId();
    expect(id).toMatch(/^sa-/);
  });

  it("returns unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSubagentId()));
    expect(ids.size).toBe(100);
  });

  it("includes task index when provided", () => {
    const id = generateSubagentId(3);
    expect(id).toMatch(/^sa-t3-/);
  });
});

describe("buildSpawnArgs", () => {
  it("returns pi args with JSON mode, prompt file arg, and no-session", () => {
    const args = buildSpawnArgs("/tmp/prompt.md");
    expect(args[0]).toBe("pi");
    expect(args).toContain("--mode");
    expect(args).toContain("json");
    expect(args).toContain("-p");
    expect(args).toContain("--no-session");
    expect(args[args.length - 1]).toBe("@/tmp/prompt.md");
  });

  it("includes model flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { model: "claude-sonnet-4-20250514" });
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-20250514");
  });

  it("includes tools flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { tools: ["read", "write"] });
    expect(args).toContain("--tools");
    expect(args).toContain("read,write");
  });

  it("includes append-system-prompt when systemPromptPath provided", () => {
    const args = buildSpawnArgs("/tmp/p.md", { systemPromptPath: "/tmp/system.md" });
    expect(args).toContain("--append-system-prompt");
    expect(args).toContain("/tmp/system.md");
  });

  it("includes thinking flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { thinking: "full" });
    expect(args).toContain("--thinking");
    expect(args).toContain("full");
  });
});

describe("buildSpawnEnv", () => {
  it("sets PI_SUBAGENT=1", () => {
    const env = buildSpawnEnv();
    expect(env.PI_SUBAGENT).toBe("1");
  });

  it("includes MEGA_SUBAGENT_ID when provided", () => {
    const env = buildSpawnEnv({ subagentId: "sa-abc123" });
    expect(env.MEGA_SUBAGENT_ID).toBe("sa-abc123");
  });

  it("includes MEGA_PROJECT_ROOT when provided", () => {
    const env = buildSpawnEnv({ subagentId: "sa-abc", projectRoot: "/project" });
    expect(env.MEGA_PROJECT_ROOT).toBe("/project");
  });

  it("preserves existing PATH", () => {
    const env = buildSpawnEnv();
    expect(env.PATH).toBeDefined();
  });
});

describe("createRunnerState", () => {
  it("initializes with zero turns and empty errors", () => {
    const state = createRunnerState("sa-001", Date.now());
    expect(state.turnsUsed).toBe(0);
    expect(state.errorLines).toEqual([]);
    expect(state.isTerminal).toBe(false);
    expect(state.pendingToolCalls).toEqual(new Map());
  });
});

describe("processJsonlLine", () => {
  it("increments turns on assistant message_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
    }));
    expect(state.turnsUsed).toBe(1);
  });

  it("does not increment turns on toolResult message_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "message_end",
      message: { role: "toolResult", content: [{ type: "text", text: "ok" }] },
    }));
    expect(state.turnsUsed).toBe(0);
  });

  it("tracks tool_execution_start to map toolCallId to toolName and args", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "bash",
      args: { command: "bun test" },
    }));
    expect(state.pendingToolCalls.get("tc-1")).toEqual({ toolName: "bash", args: { command: "bun test" } });
  });

  it("detects test runner results from tool_execution_end on bash test commands", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "bash",
      args: { command: "bun test tests/foo.test.ts" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "bash",
      result: { content: [{ type: "text", text: "42 pass\n0 fail\n" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBe(true);
  });

  it("detects failing tests from tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-2",
      toolName: "bash",
      args: { command: "bun test" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-2",
      toolName: "bash",
      result: { content: [{ type: "text", text: "10 pass\n3 fail\n" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBe(false);
  });

  it("does not detect test results from non-test bash commands", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-grep",
      toolName: "bash",
      args: { command: "grep -r 'password' src/" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-grep",
      toolName: "bash",
      result: { content: [{ type: "text", text: "src/auth.ts: const password = '3 pass'\nsrc/config.ts: 0 fail" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBeUndefined();
  });

  it("collects error lines from tool_execution_end results", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-3",
      toolName: "bash",
      result: { content: [{ type: "text", text: "Error: TypeError: x is not a function" }] },
      isError: true,
    }));
    expect(state.errorLines).toHaveLength(1);
    expect(state.errorLines[0].text).toContain("TypeError");
  });

  it("collects error lines from assistant message text (AC20)", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I see the error: TypeError: x is not a function. Let me try again." }],
      },
    }));
    expect(state.errorLines).toHaveLength(1);
    expect(state.errorLines[0].text).toContain("TypeError");
  });

  it("cleans up pending tool calls on tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "read",
      args: { path: "foo.ts" },
    }));
    expect(state.pendingToolCalls.size).toBe(1);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "read",
      result: { content: [{ type: "text", text: "file contents" }] },
      isError: false,
    }));
    expect(state.pendingToolCalls.size).toBe(0);
  });

  it("ignores invalid JSON lines", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, "not json at all");
    expect(state.turnsUsed).toBe(0);
  });

  it("ignores empty lines", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, "");
    processJsonlLine(state, "   ");
    expect(state.turnsUsed).toBe(0);
  });

  it("does not detect test results from non-bash tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "read",
      args: { path: "tests/foo.test.ts" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "read",
      result: { content: [{ type: "text", text: "42 pass\n0 fail\n" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBeUndefined();
  });
});

describe("buildSpawnEnv projectRoot", () => {
  it("sets MEGA_PROJECT_ROOT to enable satellite root resolution", () => {
    const env = buildSpawnEnv({ subagentId: "sa-1", projectRoot: "/my/project" });
    expect(env.MEGA_PROJECT_ROOT).toBe("/my/project");
    expect(env.PI_SUBAGENT).toBe("1");
  });
});
