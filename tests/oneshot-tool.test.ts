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
    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      return { stdout: "", stderr: "" };
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

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execGit);
    expect(r.error).toBeUndefined();
    // squash cleans up workspace (worktree remove when no diff)
    expect(gitCalls.some((c) => c.args.includes("worktree") && c.args.includes("remove"))).toBe(true);
  });

  it("returns an error when squash fails after successful dispatch", async () => {
    const execGit = async (args: string[]) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed: squash boom");
      }
      return { stdout: "", stderr: "" };
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
    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execGit);
    expect(r.error).toContain("Squash failed");
    expect(r.error).toContain("diff name-only failed");
  });

  it("returns cleanup errors when dispatch fails", async () => {
    const execGit = async (args: string[]) => {
      if (args.includes("worktree") && args.includes("remove") && args.includes("--force")) {
        throw new Error("forget boom");
      }
      return { stdout: "", stderr: "" };
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

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execGit);
    expect(r.error).toContain("Cleanup failed");
    expect(r.error).toContain("forget boom");
  });

  it("uses discriminated union checks (no as-any casts)", async () => {
    // Verify the source code has no (as any).error casts
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/subagent/oneshot-tool.ts"),
      "utf-8",
    );
    expect(source).not.toContain("(ws as any).error");
    expect(source).not.toContain("(squash as any).error");
    expect(source).not.toContain("(cleanup as any).error");
    // Should use .ok checks instead
    expect(source).toContain(".ok");
  });
});
