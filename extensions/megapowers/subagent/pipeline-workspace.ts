import { join, dirname } from "node:path";
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from "node:fs";

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
export type CreateWorkspaceResult =
  | { ok: true; workspaceName: string; workspacePath: string }
  | { ok: false; error: string };

export async function createPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CreateWorkspaceResult> {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    mkdirSync(join(projectRoot, ".megapowers", "workspaces"), { recursive: true });
  } catch {
    // best effort
  }

  // AC1/AC2: Temp-commit all uncommitted changes (including untracked) with injected identity
  let stagedAll = false;
  let tempCommitted = false;
  let worktreeError: string | undefined;

  try {
    await execGit(inDir(projectRoot, ["add", "-A"]));
    stagedAll = true;

    await execGit(
      inDir(projectRoot, [
        "-c",
        "user.name=megapowers",
        "-c",
        "user.email=megapowers@local",
        "commit",
        "--allow-empty",
        "--no-gpg-sign",
        "-m",
        "temp-pipeline-commit",
      ]),
    );
    tempCommitted = true;
    await execGit(inDir(projectRoot, ["worktree", "add", "--detach", workspacePath]));
  } catch (err) {
    worktreeError = err instanceof Error ? err.message : String(err);
  } finally {
    // If we staged but never successfully created the temp commit, undo staging.
    if (stagedAll && !tempCommitted) {
      try {
        await execGit(inDir(projectRoot, ["reset"]));
      } catch {
        // ignore reset cleanup error
      }
    }
  }

  // AC1/AC5: always reset if temp commit succeeded, even on worktree failure
  if (tempCommitted) {
    try {
      await execGit(inDir(projectRoot, ["reset", "HEAD~1"]));
    } catch (resetErr) {
      const resetMsg = resetErr instanceof Error ? resetErr.message : String(resetErr);
      const combined = worktreeError
        ? `${worktreeError}; reset failed: ${resetMsg}`
        : `Worktree created but reset failed: ${resetMsg}`;
      return { ok: false, error: combined };
    }
  }

  if (worktreeError) {
    return { ok: false, error: worktreeError };
  }
    return { ok: true, workspaceName, workspacePath };
}

// AC15 + AC16
export type SquashWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function squashPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<SquashWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    await execGit(inDir(workspacePath, ["add", "-A"]));
    const changed = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=AMCR"]),
    );
    // AC7: Get deleted files
    const deleted = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-only", "--diff-filter=D"]),
    );
    // Get rename entries to clean up old paths
    const renames = await execGit(
      inDir(workspacePath, ["diff", "--cached", "--name-status", "--diff-filter=R"]),
    );

    const changedFiles = changed.stdout.trim().split("\n").filter(Boolean);
    const deletedFiles = deleted.stdout.trim().split("\n").filter(Boolean);

    // Parse rename lines: "R100\told/path.ts\tnew/path.ts"
    const renameOldPaths: string[] = [];
    for (const line of renames.stdout.trim().split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        renameOldPaths.push(parts[1]);
      }
    }

    // Copy changed files from worktree to main WD
    for (const file of changedFiles) {
      const src = join(workspacePath, file);
      const dest = join(projectRoot, file);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }

    // Remove deleted files from main WD
    for (const file of deletedFiles) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }

    // Remove old paths from renames
    for (const file of renameOldPaths) {
      const dest = join(projectRoot, file);
      if (existsSync(dest)) {
        unlinkSync(dest);
      }
    }

    // Clean up worktree
    try {
      await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    } catch {
      // ignore cleanup failure
    }

    return { ok: true };
  } catch (err: any) {
    // AC9: preserve worktree for inspection on failure
    return { ok: false, error: err?.message ?? "git squash failed" };
  }
}

// AC17
export type CleanupWorkspaceResult = { ok: true } | { ok: false; error: string };

export async function cleanupPipelineWorkspace(
  projectRoot: string,
  pipelineId: string,
  execGit: ExecGit,
): Promise<CleanupWorkspaceResult> {
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);
  try {
    await execGit(inDir(projectRoot, ["worktree", "remove", "--force", workspacePath]));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "git worktree remove failed" };
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
