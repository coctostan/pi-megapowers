import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pipelineWorkspaceName,
  pipelineWorkspacePath,
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  getWorkspaceDiff,
  type ExecGit,
} from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("pipeline-workspace (git worktree)", () => {
  it("pipelineWorkspaceName returns mega-prefixed name", () => {
    expect(pipelineWorkspaceName("pipe-1")).toBe("mega-pipe-1");
  });

  it("AC21: workspace path is .megapowers/workspaces/<pipelineId>", () => {
    expect(pipelineWorkspacePath("/project", "pipe-1")).toBe("/project/.megapowers/workspaces/pipe-1");
  });

  it("AC14: createPipelineWorkspace calls git worktree add --detach", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.workspacePath).toBe("/project/.megapowers/workspaces/pipe-1");
    expect(r.workspaceName).toBe("mega-pipe-1");
    expect((r as any).error).toBeUndefined();

    expect(calls.some((a) => a.includes("worktree") && a.includes("add") && a.includes("--detach"))).toBe(true);
  });

  it("AC15: squash stages+diffs in worktree and applies in project root", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached")) return { stdout: "diff --git a/a.ts b/a.ts\n+x", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeUndefined();

    // stage in worktree
    expect(calls).toContainEqual(["-C", "/project/.megapowers/workspaces/pipe-1", "add", "-A"]);
    // diff in worktree
    expect(calls).toContainEqual(["-C", "/project/.megapowers/workspaces/pipe-1", "diff", "--cached", "HEAD"]);
    // apply in root
    expect(calls.some((a) => a[0] === "apply")).toBe(true);
  });

  it("AC16: preserves worktree on squash failure (apply throws)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("diff") && args.includes("--cached")) return { stdout: "diff content", stderr: "" };
      if (args[0] === "apply") throw new Error("git apply failed");
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeDefined();
    expect(String((r as any).error)).toContain("apply");

    // no worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });

  it("AC17: cleanupPipelineWorkspace calls git worktree remove --force", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect((r as any).error).toBeUndefined();

    expect(calls).toContainEqual(["-C", "/project", "worktree", "remove", "--force", "/project/.megapowers/workspaces/pipe-1"]);
  });

  it("AC18: getWorkspaceDiff stages changes before diffing", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--stat")) return { stdout: "a.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "full diff", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await getWorkspaceDiff("/ws", execGit);
    expect(result.diff).toBe("full diff");

    const addIdx = calls.findIndex((a) => a[0] === "-C" && a[1] === "/ws" && a[2] === "add");
    const statIdx = calls.findIndex((a) => a.includes("--stat"));
    const diffIdx = calls.findIndex((a) => a.includes("diff") && a.includes("--cached") && !a.includes("--stat"));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(statIdx).toBeGreaterThan(addIdx);
    expect(diffIdx).toBeGreaterThan(statIdx);
  });

  it("pipeline-workspace.ts has no legacy jj compat branches (isLegacyResult removed)", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/subagent/pipeline-workspace.ts"), "utf-8");
    expect(source).not.toContain("isLegacyResult");
    expect(source).not.toContain('"workspace"');
    expect(source).not.toContain('"squash"');
    expect(source).not.toContain("CompatExecResult");
  });

  it("getWorkspaceDiff.filesChanged excludes git diff --stat summary lines (e.g. 'N files changed')", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("--stat"))
        return { stdout: "src/a.ts | 3 +++\ntests/a.test.ts |  2 ++\n2 files changed, 5 insertions(+)", stderr: "" };
      if (args.includes("diff") && args.includes("--cached"))
        return { stdout: "full diff", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await getWorkspaceDiff("/ws", execGit);
    expect(result.filesChanged).toEqual(["src/a.ts", "tests/a.test.ts"]);
    expect(result.filesChanged).not.toContain("2 files changed, 5 insertions(+)");
  });
});
