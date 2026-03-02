import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handlePipelineTool } from "../extensions/megapowers/subagent/pipeline-tool.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";
import { type ExecGit } from "../extensions/megapowers/subagent/pipeline-workspace.js";

function setup(plan: string) {
  const tmp = mkdtempSync(join(tmpdir(), "pipe-tool-"));

  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "implement",
    megaEnabled: true,
    currentTaskIndex: 0,
    completedTasks: [],
    tddTaskState: null,
  });

  const planDir = join(tmp, ".megapowers", "plans", "001-test");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "plan.md"), plan);

  return tmp;
}

describe("handlePipelineTool", () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects resume without guidance (AC27)", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const dispatcher: Dispatcher = { async dispatch() { return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null }; } };

    const r = await handlePipelineTool(tmp, { taskIndex: 1, resume: true }, dispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(r.error).toContain("guidance");
  });

  it("rejects when dependencies are unmet (AC26)", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Base\n\nX\n\n### Task 2: Next [depends: 1]\n\nY\n`);

    const dispatcher: Dispatcher = { async dispatch() { return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null }; } };

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(r.error).toContain("depends");
  });

  it("handlePipelineTool accepts ExecGit and surfaces workspace creation failure", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const validInput = { taskIndex: 1 };
    const mockDispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("add")) throw new Error("git worktree failed (exit 128)");
      return { stdout: "", stderr: "" };
    };

    const result = await handlePipelineTool(tmp, validInput, mockDispatcher, execGit);
    expect(result.error).toBeDefined();
  });

  it("on completed pipeline, squashes workspace and marks the specified task done even with null TDD state", async () => {
    tmp = setup(`# Plan\n\n### Task 1: First\n\nX\n\n### Task 2: Second\n\nY\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      return { stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        if (cfg.agent === "verifier") {
          return {
            exitCode: 0,
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "1 pass\n0 fail" }] },
            ] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, execGit);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");

    expect(gitCalls.some((c) => c.args.includes("worktree") && c.args.includes("remove"))).toBe(true);

    const state = readState(tmp);
    expect(state.completedTasks).toContain(2);
  });

  it("paused pipeline returns log + diff + errorSummary (AC27) and resume reuses workspace", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      if (args.includes("--stat")) return { stdout: "src/file.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git a/src/file.ts b/src/file.ts\n+new code", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "verifier") {
          return {
            exitCode: 0,
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "0 pass\n1 fail" }] },
            ] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        return { exitCode: 0, messages: [] as any, filesChanged: [], testsPassed: null };
      },
    };

    const first = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit);
    expect(first.result?.status).toBe("paused");

    expect(first.paused).toBeDefined();
    expect(typeof first.paused?.errorSummary).toBe("string");
    expect((first.paused?.errorSummary ?? "").length).toBeGreaterThan(0);
    expect(Array.isArray(first.paused?.log)).toBe(true);
    expect((first.paused?.log ?? []).length).toBeGreaterThan(0);
    expect(first.paused?.diff).toContain("diff --git");

    const adds = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;

    const second = await handlePipelineTool(tmp, { taskIndex: 1, resume: true, guidance: "try again" }, dispatcher, execGit);
    expect(second.result?.status).toBe("paused");

    const addsAfter = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;
    expect(addsAfter).toBe(adds);
  });
});
