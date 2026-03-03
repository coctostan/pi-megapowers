---
id: 8
title: Rewrite pipeline-workspace.ts to git worktree with patch squash
status: approved
depends_on:
  - 7
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-workspace.ts
  - tests/pipeline-workspace.test.ts
files_to_create: []
---

### Task 8: Rewrite pipeline-workspace.ts to git worktree with patch squash [depends: 7]
**Covers AC 13–18, AC 21**

#### Step 1 — Write failing tests

Replace `tests/pipeline-workspace.test.ts` entirely with:

```ts
import { describe, it, expect } from "bun:test";
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
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/pipeline-workspace.test.ts`

Expected failure: module still exports `ExecJJ` and uses jj workspace commands.

#### Step 3 — Implement (full code)

Replace `extensions/megapowers/subagent/pipeline-workspace.ts` with a compiling git-worktree implementation:

```ts
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

// AC13
export type ExecGit = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

export function pipelineWorkspaceName(pipelineId: string): string {
  return `mega-${pipelineId}`;
}

// AC21
export function pipelineWorkspacePath(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "workspaces", pipelineId);
}

function inDir(cwd: string, args: string[]): string[] {
  // Use git's -C option so ExecGit stays args-only (AC13)
  return ["-C", cwd, ...args];
}

// AC14
export async function createPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });

  try {
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
    return { workspaceName, workspacePath };
  } catch (err: any) {
    return { workspaceName, workspacePath, error: err?.message ?? "git worktree add failed" };
  }
}

// AC15 + AC16
export async function squashPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const diff = await execGit(inDir(workspacePath, ["diff", "--cached", "HEAD"]));

    if (!diff.stdout.trim()) {
      // nothing to apply; remove worktree
      try {
        await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
      } catch {
        // ignore cleanup failure
      }
      return {};
    }

    const patchPath = join(tmpdir(), `mega-squash-${pipelineId}.patch`);
    writeFileSync(patchPath, diff.stdout);

    // apply in main working directory (AC15)
    await execGit(["apply", "--allow-empty", patchPath]);

    // remove worktree after successful apply
    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }

    return {};
  } catch (err: any) {
    // AC16: preserve worktree for inspection on failure
    return { error: err?.message ?? "git squash failed" };
  }
}

// AC17
export async function cleanupPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    return {};
  } catch (err: any) {
    return { error: err?.message ?? "git worktree remove failed" };
  }
}

function parseSummaryFiles(summary: string): string[] {
  // git diff --stat output is lines like: "path/to/file | 3 ++-"
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("|")[0].trim())
    .filter(Boolean);
}

// AC18
export async function getWorkspaceDiff(
  workspaceCwd: string,
  execGit: ExecGit,
): Promise<{ filesChanged: string[]; diff: string }> {
  await execGit(inDir(workspaceCwd, ["add", "-A"]));
  const stat = await execGit(inDir(workspaceCwd, ["diff", "--cached", "HEAD", "--stat"]));
  const full = await execGit(inDir(workspaceCwd, ["diff", "--cached", "HEAD"]));

  return {
    filesChanged: parseSummaryFiles(stat.stdout),
    diff: full.stdout,
  };
}
```

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/pipeline-workspace.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
