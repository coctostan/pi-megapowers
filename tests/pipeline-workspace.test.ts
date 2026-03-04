import { describe, it, expect } from "bun:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
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

  it("createPipelineWorkspace returns ok:true with workspaceName and workspacePath on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.workspacePath).toBe("/project/.megapowers/workspaces/pipe-1");
      expect(r.workspaceName).toBe("mega-pipe-1");
    }
    expect(calls.some((a) => a.includes("worktree") && a.includes("add") && a.includes("--detach"))).toBe(true);
  });

  it("createPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("fatal: worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree add failed");
    }
  });

  it("temp-commits with identity config before worktree add, then resets", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);

    const addIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("add") && a.includes("-A"),
    );
    const commitIdx = calls.findIndex(
      (a) =>
        a.includes("-C") &&
        a.includes("/project") &&
        a.includes("commit") &&
        a.includes("user.name=megapowers") &&
        a.includes("user.email=megapowers@local") &&
        a.includes("--no-gpg-sign"),
    );
    const worktreeIdx = calls.findIndex(
      (a) => a.includes("worktree") && a.includes("add"),
    );
    const resetIdx = calls.findIndex(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );

    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThan(addIdx);
    expect(worktreeIdx).toBeGreaterThan(commitIdx);
    expect(resetIdx).toBeGreaterThan(worktreeIdx);
  });

  it("resets temp commit even when worktree creation fails", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("worktree") && args.includes("add")) {
        throw new Error("worktree add failed");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    const resetCall = calls.find(
      (a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && a.includes("HEAD~1"),
    );
    expect(resetCall).toBeDefined();
  });

  it("unstages changes if commit fails after add -A", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("commit")) throw new Error("commit failed");
      return { stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);

    // ensure we attempted to undo staging so main WD is not left in a different state
    expect(
      calls.some((a) => a.includes("-C") && a.includes("/project") && a.includes("reset") && !a.includes("HEAD~1")),
    ).toBe(true);
  });

  it("integration: worktree contains uncommitted additions from main WD (AC2)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ws-integ-"));
    try {
      execSync("git init", { cwd: tmp, stdio: "pipe" });
      execSync('git -c user.name=test -c user.email=test@test commit --allow-empty -m "init"', {
        cwd: tmp,
        stdio: "pipe",
      });

      // Create uncommitted file (the core bug case)
      writeFileSync(join(tmp, "new-file.ts"), "export const x = 1;");

      const realExecGit: ExecGit = async (args) => {
        const result = execSync(`git ${args.join(" ")}`, { stdio: "pipe", encoding: "utf-8" });
        return { stdout: String(result), stderr: "" };
      };

      const r = await createPipelineWorkspace(tmp, "integ-1", realExecGit);
      expect(r.ok).toBe(true);
      if (r.ok) {
        // AC2: The new file should exist in the worktree
        expect(existsSync(join(r.workspacePath, "new-file.ts"))).toBe(true);
        expect(readFileSync(join(r.workspacePath, "new-file.ts"), "utf-8")).toBe("export const x = 1;");
      }

      // AC1: Main WD should be unchanged (reset happened)
      expect(existsSync(join(tmp, "new-file.ts"))).toBe(true);
    } finally {
      try {
        execSync(
          `git -C "${tmp}" worktree remove --force "${join(tmp, ".megapowers", "workspaces", "integ-1")}"`,
          { stdio: "pipe" },
        );
      } catch {}
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("squashPipelineWorkspace returns ok:true on success", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--name-only"))
        return { stdout: "diff --git a/a.ts b/a.ts\n+x", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squashPipelineWorkspace returns ok:true when there are no changes", async () => {
    const execGit: ExecGit = async () => {
      // --name-only returns empty = no changed files
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
  });

  it("squash copies changed files from worktree to project root (file-copy, not git apply)", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-copy-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(join(wsPath, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    writeFileSync(join(wsPath, "src", "new.ts"), "export const x = 1;");
    writeFileSync(join(wsPath, "src", "modified.ts"), "updated content");
    writeFileSync(join(projectRoot, "src", "modified.ts"), "old content");

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "src/new.ts\nsrc/modified.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(readFileSync(join(projectRoot, "src", "new.ts"), "utf-8")).toBe("export const x = 1;");
    expect(readFileSync(join(projectRoot, "src", "modified.ts"), "utf-8")).toBe("updated content");

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("squash deletes files identified by diff-filter=D", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-del-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    writeFileSync(join(projectRoot, "old.ts"), "to be removed");

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "old.ts\n", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(existsSync(join(projectRoot, "old.ts"))).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("squash handles renames by copying new path and deleting old path", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "squash-rename-"));
    const wsPath = join(projectRoot, ".megapowers", "workspaces", "pipe-1");
    mkdirSync(wsPath, { recursive: true });

    // old/path.ts exists in project root (the rename source)
    mkdirSync(join(projectRoot, "old"), { recursive: true });
    writeFileSync(join(projectRoot, "old", "path.ts"), "old content");
    // new/path.ts exists in worktree (the rename destination)
    mkdirSync(join(wsPath, "new"), { recursive: true });
    writeFileSync(join(wsPath, "new", "path.ts"), "renamed content");

    const execGit: ExecGit = async (args) => {
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        return { stdout: "new/path.ts\n", stderr: "" };
      }
      if (args.includes("--name-only") && args.includes("--diff-filter=D")) {
        return { stdout: "", stderr: "" };
      }
      if (args.includes("--name-status") && args.includes("--diff-filter=R")) {
        return { stdout: "R100\told/path.ts\tnew/path.ts\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const r = await squashPipelineWorkspace(projectRoot, "pipe-1", execGit);
    expect(r.ok).toBe(true);
    // new path was copied
    expect(readFileSync(join(projectRoot, "new", "path.ts"), "utf-8")).toBe("renamed content");
    // old path was removed
    expect(existsSync(join(projectRoot, "old", "path.ts"))).toBe(false);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("squashPipelineWorkspace returns ok:false on failure and preserves worktree", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.includes("--name-only") && args.includes("--diff-filter=AMCR")) {
        throw new Error("diff name-only failed");
      }
      return { stdout: "", stderr: "" };
    };
    const r = await squashPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("diff name-only failed");
    }
    // No worktree remove on failure
    expect(calls.some((a) => a.includes("worktree") && a.includes("remove"))).toBe(false);
  });

  it("cleanupPipelineWorkspace returns ok:true on success", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(true);
    expect(calls).toContainEqual([
      "-C", "/project", "worktree", "remove", "--force",
      "/project/.megapowers/workspaces/pipe-1",
    ]);
  });

  it("cleanupPipelineWorkspace returns ok:false with error on failure", async () => {
    const execGit: ExecGit = async (args) => {
      if (args.includes("worktree") && args.includes("remove")) {
        throw new Error("worktree remove failed: not a valid directory");
      }
      return { stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execGit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("worktree remove failed");
    }
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
