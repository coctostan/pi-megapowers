/** Injected git executor — throws on non-zero exit. */
export type ExecGit = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

export type GitResult = { ok: true } | { ok: false; error: string };

/**
 * AC2: Create a new branch from a given base branch.
 * Runs `git checkout -b <branchName> <baseBranch>`.
 */
export async function createBranch(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
): Promise<GitResult> {
  try {
    await execGit(["checkout", "-b", branchName, baseBranch]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "createBranch failed" };
  }
}

/**
 * AC3: Check out an existing branch.
 * Runs `git checkout <branchName>`.
 */
export async function checkoutBranch(
  execGit: ExecGit,
  branchName: string,
): Promise<GitResult> {
  try {
    await execGit(["checkout", branchName]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "checkoutBranch failed" };
  }
}

export type WipCommitResult = { ok: true; committed: boolean } | { ok: false; error: string };

/**
 * AC4: Stage all changes, check for uncommitted changes, commit if any.
 * Returns committed: false when working tree is clean.
 */
export async function wipCommit(
  execGit: ExecGit,
  message: string,
): Promise<WipCommitResult> {
  try {
    await execGit(["add", "-A"]);
    const status = await execGit(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return { ok: true, committed: false };
    }
    await execGit(["commit", "-m", message]);
    return { ok: true, committed: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "wipCommit failed" };
  }
}

export type SquashResult = { ok: true; committed: boolean } | { ok: false; error: string };

/**
 * AC5: Soft-reset to base branch and commit all changes as a single squash commit.
 * Returns committed: false when there is nothing to commit after reset.
 */
export async function squashOnto(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashResult> {
  try {
    await execGit(["reset", "--soft", baseBranch]);
    const status = await execGit(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
      return { ok: true, committed: false };
    }
    await execGit(["commit", "-m", commitMessage]);
    return { ok: true, committed: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "squashOnto failed" };
  }
}

/**
 * AC6: Push a branch to origin.
 * Uses --force-with-lease when force is true (safe force push after squash).
 */
export async function pushBranch(
  execGit: ExecGit,
  branchName: string,
  force: boolean,
): Promise<GitResult> {
  try {
    const args = ["push", "origin", branchName];
    if (force) args.push("--force-with-lease");
    await execGit(args);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "pushBranch failed" };
  }
}
