import { join } from "node:path";

export function buildWorkspaceName(subagentId: string): string {
  return `mega-${subagentId}`;
}

export function workspacePath(cwd: string, subagentId: string): string {
  return join(cwd, ".megapowers", "subagents", subagentId, "workspace");
}

export function buildWorkspaceAddArgs(workspaceName: string, targetPath: string): string[] {
  return ["workspace", "add", "--name", workspaceName, targetPath];
}

export function buildWorkspaceForgetArgs(workspaceName: string): string[] {
  return ["workspace", "forget", workspaceName];
}

export function buildWorkspaceSquashArgs(workspaceName: string): string[] {
  return ["squash", "--from", `${workspaceName}@`];
}

export function buildDiffSummaryArgs(): string[] {
  return ["diff", "--summary"];
}

export function buildDiffFullArgs(): string[] {
  return ["diff"];
}
