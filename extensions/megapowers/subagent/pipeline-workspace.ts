import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

export interface ExecJJResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ExecJJ = (args: string[], opts?: { cwd?: string }) => Promise<ExecJJResult>;

export function pipelineWorkspaceName(pipelineId: string): string {
  return `mega-${pipelineId}`;
}

export function pipelineWorkspacePath(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "subagents", pipelineId, "workspace");
}

export async function createPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  const r = await execJJ(["workspace", "add", "--name", workspaceName, workspacePath]);
  if (r.code !== 0) {
    return { workspaceName, workspacePath, error: r.stderr || `jj workspace add failed (code ${r.code})` };
  }

  return { workspaceName, workspacePath };
}

export async function squashPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);

  const squash = await execJJ(["squash", "--from", `${workspaceName}@`]);
  if (squash.code !== 0) return { error: squash.stderr || `squash failed (code ${squash.code})` };

  const forget = await execJJ(["workspace", "forget", workspaceName]);
  if (forget.code !== 0) return { error: forget.stderr || `workspace forget failed (code ${forget.code})` };

  return {};
}

export async function cleanupPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  const forget = await execJJ(["workspace", "forget", workspaceName]);

  if (existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });

  if (forget.code !== 0) {
    return { error: forget.stderr || `workspace forget failed (code ${forget.code})` };
  }

  return {};
}

function parseSummaryFiles(summary: string): string[] {
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[A-Z]\s+/, ""));
}

export async function getWorkspaceDiff(
  workspaceCwd: string,
  execJJ: ExecJJ,
): Promise<{ filesChanged: string[]; diff: string }> {
  const summary = await execJJ(["diff", "--summary"], { cwd: workspaceCwd });
  const full = await execJJ(["diff"], { cwd: workspaceCwd });

  return {
    filesChanged: parseSummaryFiles(summary.stdout),
    diff: full.stdout,
  };
}
