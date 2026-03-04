import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPipeline } from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";
import type { ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "pipeline-runner-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function mkDispatch(exitCode: number, extra?: Partial<DispatchResult>): DispatchResult {
  return {
    exitCode,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    ...extra,
  };
}

const passingShell: ExecShell = async () => ({
  exitCode: 0,
  stdout: "3 pass\n0 fail",
  stderr: "",
});

const failingShell: ExecShell = async () => ({
  exitCode: 1,
  stdout: "2 pass\n1 fail\nERROR: expected true to be false at tests/foo.test.ts:12",
  stderr: "",
});

describe("runPipeline (refactored)", () => {
  it("happy path: implement -> shell verify -> frontmatter review => completed", async () => {
    const called: string[] = [];

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
              },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{
              role: "assistant" as const,
              content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n\nLooks good.\n\n- Clean code" }],
            }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Do task", planSection: "### Task 1" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.reviewVerdict).toBe("approve");
    expect(r.testsPassed).toBe(true);
    expect(r.testOutput).toContain("3 pass");
    expect(r.infrastructureError).toBeUndefined();
    // Only 2 agents dispatched (no verifier)
    expect(called).toEqual(["implementer", "reviewer"]);
  });

  it("verify failure retries with bounded test output (not accumulated)", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, { messages: [] as any });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: failingShell,
        maxRetries: 1,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(implCount).toBe(2);
    expect(r.errorSummary).toContain("Retry budget exhausted");
    expect(r.infrastructureError).toBeUndefined();
    expect(secondImplContext).toBeDefined();
    expect(secondImplContext).toContain("expected true to be false");
    expect(secondImplContext).toContain("verify_failed");
  });

  it("review rejection retries with findings in bounded context", async () => {
    const called: string[] = [];
    let cycle = 0;
    let secondCycleImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          if (cycle === 1) secondCycleImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          if (cycle === 0) {
            cycle++;
            return mkDispatch(0, {
              messages: [{
                role: "assistant" as const,
                content: [{
                  type: "text" as const,
                  text: "---\nverdict: reject\n---\n\n- Missing error handling in parser\n- No edge case coverage",
                }],
              }] as any,
            });
          }
          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Implement parser" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 3,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.reviewVerdict).toBe("approve");
    expect(r.infrastructureError).toBeUndefined();
    // 2 agents per cycle × 2 cycles = 4 dispatches (no verifier)
    expect(called).toEqual(["implementer", "reviewer", "implementer", "reviewer"]);
    expect(secondCycleImplContext).toContain("Missing error handling in parser");
    expect(secondCycleImplContext).toContain("review_rejected");
  });

  it("infrastructure failures (timeout) populate infrastructureError, not domain fields (AC26)", async () => {
    let tries = 0;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          tries++;
          throw new Error("TimeoutError: step exceeded timeout");
        }
        return mkDispatch(0, { messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(tries).toBe(1);
    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(r.errorSummary).toContain("TimeoutError");
    // Domain fields NOT populated for infra failures
    expect(r.testsPassed).toBeUndefined();
    expect(r.reviewVerdict).toBeUndefined();
  });

  it("verify infrastructure failure populates infrastructureError", async () => {
    const dispatcher: Dispatcher = { async dispatch() { return mkDispatch(0, { messages: [] as any }); } };
    const throwingShell: ExecShell = async () => { throw new Error("spawn ENOENT"); };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      { projectRoot, workspaceCwd: join(projectRoot, "ws"), pipelineId: "p", agents: { implementer: "implementer", reviewer: "reviewer" }, execGit: async () => ({ stdout: "", stderr: "" }), execShell: throwingShell, maxRetries: 0 },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("ENOENT");
    expect(r.testsPassed).toBeUndefined();
  });

  it("review rejection pause includes reviewVerdict and reviewFindings", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: reject\n---\n\n- Missing error handling" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(r.reviewVerdict).toBe("reject");
    expect(r.reviewFindings).toContain("Missing error handling");
    expect(r.errorSummary).toContain("review still rejecting");
  });

  it("reviewer dispatch failure uses review_failed retry reason and populates infrastructureError", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(1, { error: "TimeoutError: reviewer timed out", messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 1,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(implCount).toBe(2);
    expect(secondImplContext).toContain("review_failed");
  });
});
