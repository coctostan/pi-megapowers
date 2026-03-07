import { squashAndPush } from "./branch-manager.js";
import { createPR, type ExecCmd, type PRResult } from "./pr-creator.js";
import type { ExecGit } from "./git-ops.js";
export type { ExecGit } from "./git-ops.js";

export interface ShipmentAudit {
  tracked: string[];
  includedUntracked: string[];
  ignoredUntracked: string[];
  blockedUntracked: string[];
}

// Explicit denylist for obviously suspicious junk that should never ship by default:
// secret env files, OS cruft, and crash/debug logs.
const DENYLIST: RegExp[] = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^npm-debug\.log$/,
  /^yarn-error\.log$/,
  /^\.env(?:\..+)?$/,
];
// `^\.env(?:\..+)?$` intentionally matches `.env`, `.env.local`, `.env.prod`, and `.env.*.local` variants.

function parsePorcelainLine(line: string): { code: string; path: string } | null {
  if (!line.trim()) return null;
  const code = line.slice(0, 2);
  const path = line.slice(3).trim();
  if (!path) return null;
  return { code, path };
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export async function auditShipment(execGit: ExecGit): Promise<ShipmentAudit> {
  const status = await execGit(["status", "--porcelain", "--untracked-files=all", "--ignored"]);
  const tracked: string[] = [];
  const includedUntracked: string[] = [];
  const ignoredUntracked: string[] = [];
  const blockedUntracked: string[] = [];

  for (const rawLine of status.stdout.split("\n")) {
    const parsed = parsePorcelainLine(rawLine);
    if (!parsed) continue;

    if (parsed.code === "!!") {
      ignoredUntracked.push(parsed.path);
      continue;
    }

    if (parsed.code === "??") {
      const name = basename(parsed.path);
      if (DENYLIST.some((pattern) => pattern.test(name))) blockedUntracked.push(parsed.path);
      else includedUntracked.push(parsed.path);
      continue;
    }

    tracked.push(parsed.path);
  }

  return { tracked, includedUntracked, ignoredUntracked, blockedUntracked };
}

export type FinalizeShipmentResult =
  | { ok: true; committed: boolean; audit: ShipmentAudit }
  | { ok: false; error: string; blockedFiles?: string[] };

export async function finalizeShipment(
  execGit: ExecGit,
  issueSlug: string,
): Promise<FinalizeShipmentResult> {
  const audit = await auditShipment(execGit);

  if (audit.blockedUntracked.length > 0) {
    return {
      ok: false,
      error: `Blocked suspicious untracked files: ${audit.blockedUntracked.join(", ")}`,
      blockedFiles: audit.blockedUntracked,
    };
  }

  const hasTracked = audit.tracked.length > 0;
  const hasIncludedUntracked = audit.includedUntracked.length > 0;
  if (!hasTracked && !hasIncludedUntracked) {
    return { ok: true, committed: false, audit };
  }

  await execGit(["add", "-u"]);
  for (const path of audit.includedUntracked) {
    await execGit(["add", "--", path]);
  }

  const status = await execGit(["status", "--porcelain"]);
  if (!status.stdout.trim()) {
    return { ok: true, committed: false, audit };
  }

  await execGit(["commit", "-m", `chore: finalize ${issueSlug}`]);
  return { ok: true, committed: true, audit };
}

export type ShipTargetResult = { ok: true } | { ok: false; error: string };

export function validateShipTarget(branchName: string | null, baseBranch: string | null): ShipTargetResult {
  if (branchName === null) return { ok: false, error: "Cannot ship: branchName is missing." };
  if (branchName.trim() === "") return { ok: false, error: "Cannot ship: branchName is empty." };
  if (!baseBranch || baseBranch.trim() === "") return { ok: false, error: "Cannot ship: baseBranch is missing." };
  if (branchName === baseBranch) {
    return { ok: false, error: `Cannot ship: branchName must differ from baseBranch (${baseBranch}).` };
  }
  return { ok: true };
  // Exporting `ShipTargetResult` keeps the orchestration contract explicit for downstream callers/tests.
}

export interface ShipRequest {
  execGit: ExecGit;
  execCmd: ExecCmd;
  issueSlug: string;
  branchName: string | null;
  baseBranch: string | null;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export type ShipResult =
  | { ok: true; finalized: boolean; pushed: true; pr: PRResult }
  | {
      ok: false;
      step: "validate" | "finalize" | "squash" | "push";
      error: string;
      pushed: false;
      blockedFiles?: string[];
    }
  | { ok: false; step: "pr"; error: string; pushed: true; pr: { ok: false; error: string } };

export async function shipAndCreatePR(request: ShipRequest): Promise<ShipResult> {
  const target = validateShipTarget(request.branchName, request.baseBranch);
  if (!target.ok) {
    return { ok: false, step: "validate", error: target.error, pushed: false };
  }

  const finalized = await finalizeShipment(request.execGit, request.issueSlug);
  if (!finalized.ok) {
    return { ok: false, step: "finalize", error: finalized.error, pushed: false, blockedFiles: finalized.blockedFiles };
  }

  const pushed = await squashAndPush(
    request.execGit,
    request.branchName!,
    request.baseBranch!,
    request.commitMessage,
  );
  if (!pushed.ok) {
    return { ok: false, step: pushed.step, error: pushed.error, pushed: false };
  }

  const pr = await createPR(
    request.execCmd,
    request.baseBranch!,
    request.branchName!,
    request.prTitle,
    request.prBody,
  );
  if ("error" in pr) {
    return { ok: false, step: "pr", error: pr.error, pushed: true, pr };
  }
  return { ok: true, finalized: finalized.committed, pushed: true, pr };
}
