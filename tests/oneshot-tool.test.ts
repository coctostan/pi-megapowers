import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handleOneshotTool } from "../extensions/megapowers/subagent/oneshot-tool.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";

describe("handleOneshotTool", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "oneshot-"));
    writeState(tmp, { ...createInitialState(), megaEnabled: true, phase: "implement", activeIssue: "001" });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("squashes workspace on success", async () => {
    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execJJ);
    expect(r.error).toBeUndefined();
    expect(jjCalls.some((c) => c.args[0] === "squash")).toBe(true);
  });

  it("returns an error when squash fails after successful dispatch", async () => {
    const execJJ = async (args: string[]) => {
      if (args[0] === "squash") return { code: 1, stdout: "", stderr: "squash boom" };
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execJJ);
    expect(r.error).toContain("Squash failed");
    expect(r.error).toContain("squash boom");
  });

  it("returns cleanup errors when dispatch fails", async () => {
    const execJJ = async (args: string[]) => {
      if (args[0] === "workspace" && args[1] === "forget") return { code: 1, stdout: "", stderr: "forget boom" };
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 1,
          messages: [] as any,
          filesChanged: [],
          testsPassed: null,
          error: "dispatch failed",
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execJJ);
    expect(r.error).toContain("Cleanup failed");
    expect(r.error).toContain("forget boom");
  });
});
