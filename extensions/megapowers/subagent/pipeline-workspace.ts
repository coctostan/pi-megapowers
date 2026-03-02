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
  return ["-C", cwd, ...args];
}

// AC14
export async function createPipelineWorkspace(projectRoot: string, pipelineId: string, execGit: ExecGit) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  try {
    mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });
  } catch {
    // best effort; execGit surfaces actionable errors
  }

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
  // Only include lines that contain "| N" (file stat lines); skip summary lines like "2 files changed, ..."
  return summary
    .split("\n")
    .filter((l) => /\|\s*\d/.test(l))
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
