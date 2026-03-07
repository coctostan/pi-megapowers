import { createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch, type ExecGit, type WipCommitResult } from "./git-ops.js";

/** AC8: Return type matches spec exactly — no baseBranch exposed. */
export type EnsureBranchResult = { branchName: string } | { error: string };

/**
 * AC8: Generate branch name (feat/ or fix/), check if it exists, create or checkout.
 * AC21: Returns error when not in a git repository.
 *
 * Branch creation is always from the current `HEAD` (i.e. whatever is currently checked out).
 */
export async function ensureBranch(
  execGit: ExecGit,
  slug: string,
  workflow: "feature" | "bugfix",
): Promise<EnsureBranchResult> {
  const prefix = workflow === "feature" ? "feat" : "fix";
  const branchName = `${prefix}/${slug}`;

  // AC21: Check if we're in a git repo
  try {
    await execGit(["rev-parse", "--git-dir"]);
  } catch {
    return { error: "Not a git repository. VCS features are unavailable." };
  }

  // Check if branch already exists
  try {
    await execGit(["rev-parse", "--verify", branchName]);
    // Branch exists — check it out
    const result = await checkoutBranch(execGit, branchName);
    if (!result.ok) return { error: result.error };
    return { branchName };
  } catch {
    // Branch doesn't exist — create from current HEAD (AC8).
    const result = await createBranch(execGit, branchName, "HEAD");
    if (!result.ok) return { error: result.error };
    return { branchName };
  }
}

/**
 * AC9: Perform a WIP commit on the current branch before switching away.
 * Message format: "WIP: <currentBranch>". Skips if working tree is clean.
 */
export async function switchAwayCommit(
  execGit: ExecGit,
  currentBranch: string,
): Promise<WipCommitResult> {
  return wipCommit(execGit, `WIP: ${currentBranch}`);
}

export type SquashAndPushResult = { ok: true } | { ok: false; error: string; step: "squash" | "push" };

export type SquashStepResult =
  | { ok: true; committed: boolean }
  | { ok: false; error: string; step: "squash" };

export async function squashBranchToSingleCommit(
  execGit: ExecGit,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashStepResult> {
  const squashResult = await squashOnto(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }

  return { ok: true, committed: squashResult.committed };
}

/**
 * AC10: Squash all commits onto base branch and force-push.
 * Returns the failing step name on error for targeted retry/reporting.
 */
export async function squashAndPush(
  execGit: ExecGit,
  branchName: string,
  baseBranch: string,
  commitMessage: string,
): Promise<SquashAndPushResult> {
  const squashResult = await squashBranchToSingleCommit(execGit, baseBranch, commitMessage);
  if (!squashResult.ok) {
    return { ok: false, error: squashResult.error, step: "squash" };
  }
  const pushResult = await pushBranch(execGit, branchName, true);
  if (!pushResult.ok) {
    return { ok: false, error: pushResult.error, step: "push" };
  }
  return { ok: true };
}
