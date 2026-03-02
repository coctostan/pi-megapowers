import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPipeline } from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

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

describe("runPipeline", () => {
  it("happy path: implement -> verify(pass) -> review(approve) => completed (includes test output)", async () => {
    const called: string[] = [];
    let implContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          implContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
              },
            ] as any,
          });
        }

        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "1 pass\n0 fail" }] },
              { role: "assistant" as const, content: [{ type: "text" as const, text: "RAW TEST OUTPUT: 1 pass / 0 fail" }] },
            ] as any,
          });
        }

        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
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
        workspaceCwd: join(projectRoot, ".megapowers", "subagents", "pipe", "workspace"),
        pipelineId: "pipe",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.reviewVerdict).toBe("approve");
    expect(r.testOutput).toContain("RAW TEST OUTPUT");
    expect(r.testOutput).toContain("1 pass");
    expect(called).toEqual(["implementer", "verifier", "reviewer"]);
    expect(implContext).toBeDefined();
    expect(implContext).toContain("### Task 1");
    expect(implContext).toContain("Do task");
  });

  it("verify failure retries implement->verify, passing failure output into retry context (AC5)", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, { messages: [] as any });
        }

        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              {
                role: "tool" as const,
                content: [
                  {
                    type: "tool_result" as const,
                    tool_use_id: "t",
                    content: "0 pass\n1 fail\n\nERROR: expected true to be false at tests/foo.test.ts:12",
                  },
                ],
              },
            ] as any,
          });
        }

        return mkDispatch(0, { messages: [{ role: "assistant", content: [{ type: "text", text: "Verdict: approve" }] }] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, ".megapowers", "subagents", "p", "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 1,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(implCount).toBe(2);
    expect(r.errorSummary).toContain("Retry budget exhausted");
    expect(r.diff).toContain("diff --git");
    expect(Array.isArray(r.logEntries)).toBe(true);
    expect(secondImplContext).toBeDefined();
    expect(secondImplContext).toContain("0 pass");
    expect(secondImplContext).toContain("1 fail");
    expect(secondImplContext).toContain("expected true to be false");
  });

  it("review rejection retries full implement->verify->review with findings in context (AC6)", async () => {
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

        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "5 pass\n0 fail" }] },
            ] as any,
          });
        }

        if (cfg.agent === "reviewer") {
          if (cycle === 0) {
            cycle++;
            return mkDispatch(0, {
              messages: [
                {
                  role: "assistant" as const,
                  content: [
                    {
                      type: "text" as const,
                      text: "Verdict: reject\n\n## Findings\n- Missing error handling in parser\n- No edge case coverage",
                    },
                  ],
                },
              ] as any,
            });
          }

          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
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
        workspaceCwd: join(projectRoot, ".megapowers", "subagents", "p", "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 3,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.reviewVerdict).toBe("approve");
    expect(called).toEqual(["implementer", "verifier", "reviewer", "implementer", "verifier", "reviewer"]);
    expect(secondCycleImplContext).toBeDefined();
    expect(secondCycleImplContext).toContain("Missing error handling in parser");
    expect(secondCycleImplContext).toContain("No edge case coverage");
    expect(secondCycleImplContext).toContain("Accumulated Review Findings");
  });

  it("timeout errors count toward retry budget", async () => {
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
        workspaceCwd: join(projectRoot, ".megapowers", "subagents", "p", "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 0,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(tries).toBe(1);
    expect(r.status).toBe("paused");
    expect(r.errorSummary).toContain("TimeoutError");
  });

  it("treats review step execution failures as failures (not generic rejection)", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }

        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "1 pass\n0 fail" }] },
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
        workspaceCwd: join(projectRoot, ".megapowers", "subagents", "p", "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 0,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(r.status).toBe("paused");
    expect(r.errorSummary).toContain("review");
    expect(r.errorSummary).toContain("TimeoutError");
  });
});
