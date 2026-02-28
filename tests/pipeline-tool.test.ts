import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handlePipelineTool } from "../extensions/megapowers/subagent/pipeline-tool.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";

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

  it("on completed pipeline, squashes workspace and marks the specified task done even with null TDD state", async () => {
    tmp = setup(`# Plan\n\n### Task 1: First\n\nX\n\n### Task 2: Second\n\nY\n`);

    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
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

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, execJJ);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");

    expect(jjCalls.some((c) => c.args[0] === "squash")).toBe(true);

    const state = readState(tmp);
    expect(state.completedTasks).toContain(2);
  });

  it("paused pipeline returns log + diff + errorSummary (AC27) and resume reuses workspace", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "M src/file.ts\n", stderr: "" };
      if (args[0] === "diff") return { code: 0, stdout: "diff --git a/src/file.ts b/src/file.ts\n+new code", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
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

    const first = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execJJ);
    expect(first.result?.status).toBe("paused");

    expect(first.paused).toBeDefined();
    expect(typeof first.paused?.errorSummary).toBe("string");
    expect((first.paused?.errorSummary ?? "").length).toBeGreaterThan(0);
    expect(Array.isArray(first.paused?.log)).toBe(true);
    expect((first.paused?.log ?? []).length).toBeGreaterThan(0);
    expect(first.paused?.diff).toContain("diff --git");

    const adds = jjCalls.filter((c) => c.args[0] === "workspace" && c.args[1] === "add").length;

    const second = await handlePipelineTool(tmp, { taskIndex: 1, resume: true, guidance: "try again" }, dispatcher, execJJ);
    expect(second.result?.status).toBe("paused");

    const addsAfter = jjCalls.filter((c) => c.args[0] === "workspace" && c.args[1] === "add").length;
    expect(addsAfter).toBe(adds);
  });
});
