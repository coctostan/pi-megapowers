import type { ExecGit } from "./git-ops.js";

export type BranchSyncStatus = {
  hasRemote: boolean;
  behind: number;
  ahead: number;
};

export async function checkBranchSync(
  execGit: ExecGit,
  baseBranch: string,
): Promise<BranchSyncStatus> {
  // Check if any remote is configured
  try {
    const remoteResult = await execGit(["remote"]);
    if (!remoteResult.stdout.trim()) {
      return { hasRemote: false, behind: 0, ahead: 0 };
    }
  } catch {
    return { hasRemote: false, behind: 0, ahead: 0 };
  }

  // Fetch from origin
  try {
    await execGit(["fetch", "origin"]);
  } catch {
    // Fail-open: treat as in-sync if fetch fails
    return { hasRemote: true, behind: 0, ahead: 0 };
  }

  // Compare local vs remote
  try {
    const result = await execGit([
      "rev-list", "--left-right", "--count",
      `${baseBranch}...origin/${baseBranch}`,
    ]);
    const parts = result.stdout.trim().split(/\s+/);
    const ahead = parseInt(parts[0] ?? "0", 10) || 0;
    const behind = parseInt(parts[1] ?? "0", 10) || 0;
    return { hasRemote: true, behind, ahead };
  } catch {
    return { hasRemote: true, behind: 0, ahead: 0 };
  }
}
