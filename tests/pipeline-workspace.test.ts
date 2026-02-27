import { describe, it, expect } from "bun:test";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  pipelineWorkspaceName,
  pipelineWorkspacePath,
  type ExecJJ,
} from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("pipeline workspace", () => {
  it("creates workspace at .megapowers/subagents/{id}/workspace", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(r.workspaceName).toBe("mega-pipe-1");
    expect(r.workspacePath).toBe("/project/.megapowers/subagents/pipe-1/workspace");
    expect(calls[0].args).toEqual([
      "workspace",
      "add",
      "--name",
      "mega-pipe-1",
      "/project/.megapowers/subagents/pipe-1/workspace",
    ]);

    expect(pipelineWorkspaceName("pipe-1")).toBe("mega-pipe-1");
    expect(pipelineWorkspacePath("/project", "pipe-1")).toBe("/project/.megapowers/subagents/pipe-1/workspace");
  });

  it("squashes from workspace and forgets", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    await squashPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(calls[0].args).toEqual(["squash", "--from", "mega-pipe-1@"]);
    expect(calls[1].args).toEqual(["workspace", "forget", "mega-pipe-1"]);
  });

  it("cleanup forgets workspace and removes dir", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(r.error).toBeUndefined();
    expect(calls[0].args).toEqual(["workspace", "forget", "mega-pipe-1"]);
  });
});
