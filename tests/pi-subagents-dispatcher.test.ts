import { describe, it, expect } from "bun:test";
import { PiSubagentsDispatcher } from "../extensions/megapowers/subagent/pi-subagents-dispatcher.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { RunSyncOptions, SingleResult } from "pi-subagents/types.js";

describe("PiSubagentsDispatcher", () => {
  it("maps DispatchConfig overrides onto an agent config and calls runSync", async () => {
    let captured: any = null;

    const mockRunSync = async (
      runtimeCwd: string,
      agents: AgentConfig[],
      agentName: string,
      task: string,
      options: RunSyncOptions,
    ): Promise<SingleResult> => {
      captured = { runtimeCwd, agents, agentName, task, options };
      return {
        agent: agentName,
        task,
        exitCode: 0,
        messages: [],
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      };
    };

    const baseAgents: AgentConfig[] = [
      {
        name: "implementer",
        description: "impl",
        tools: ["read"],
        model: "anthropic/claude-haiku-4-5",
        thinking: "low",
        systemPrompt: "BASE",
        source: "project",
        filePath: "/x",
      },
    ];

    const d = new PiSubagentsDispatcher({ runSync: mockRunSync, runtimeCwd: "/runtime", agents: baseAgents });

    await d.dispatch({
      agent: "implementer",
      task: "Do the work",
      cwd: "/workspace",
      context: "extra ctx",
      model: "anthropic/claude-sonnet-4-5",
      thinking: "high",
      tools: ["read", "write"],
      systemPrompt: "OVERRIDE",
      timeoutMs: 1234,
    });

    expect(captured.runtimeCwd).toBe("/runtime");
    expect(captured.agentName).toBe("implementer");

    // Task prompt should include context
    expect(captured.task).toContain("Do the work");
    expect(captured.task).toContain("## Context");
    expect(captured.task).toContain("extra ctx");

    // Overrides should be applied to the agent config used by runSync
    const impl = captured.agents.find((a: any) => a.name === "implementer");
    expect(impl.model).toBe("anthropic/claude-sonnet-4-5");
    expect(impl.thinking).toBe("high");
    expect(impl.tools).toEqual(["read", "write"]);
    expect(impl.systemPrompt).toContain("BASE");
    expect(impl.systemPrompt).toContain("OVERRIDE");

    // runSync options
    expect(captured.options.cwd).toBe("/workspace");
    expect(typeof captured.options.runId).toBe("string");
  });
});
