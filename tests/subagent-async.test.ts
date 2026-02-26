import { describe, it, expect } from "bun:test";
import {
  buildDispatchConfig,
  type DispatchConfig,
  DEFAULT_TIMEOUT_MS,
} from "../extensions/megapowers/subagent/subagent-async.js";

describe("DEFAULT_TIMEOUT_MS", () => {
  it("defaults to 10 minutes", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });
});

describe("buildDispatchConfig", () => {
  it("builds config with required fields", () => {
    const config = buildDispatchConfig({
      id: "sa-001",
      prompt: "Do the thing",
      cwd: "/project",
      workspacePath: "/project/.megapowers/subagents/sa-001/workspace",
    });
    expect(config.id).toBe("sa-001");
    expect(config.prompt).toBe("Do the thing");
    expect(config.workspacePath).toBe("/project/.megapowers/subagents/sa-001/workspace");
    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("uses custom timeout when provided", () => {
    const config = buildDispatchConfig({
      id: "sa-002",
      prompt: "Do another thing",
      cwd: "/project",
      workspacePath: "/tmp/ws",
      timeoutMs: 5 * 60 * 1000,
    });
    expect(config.timeoutMs).toBe(5 * 60 * 1000);
  });

  it("includes agent options when provided", () => {
    const config = buildDispatchConfig({
      id: "sa-003",
      prompt: "Research",
      cwd: "/project",
      workspacePath: "/tmp/ws",
      model: "claude-sonnet-4-20250514",
      tools: ["read", "bash"],
    });
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.tools).toEqual(["read", "bash"]);
  });
});
