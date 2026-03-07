import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, spawnSync } from "node:child_process";
import { shipAndCreatePR } from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";

function runGit(command: string, cwd: string): string {
  try {
    return execSync(command, { cwd, stdio: "pipe", encoding: "utf8" }) ?? "";
  } catch (error: any) {
    throw new Error(`git command failed: ${command}\n${error?.message ?? error}`);
  }
}

describe("VCS lifecycle integration", () => {
  let tmp: string;
  let remote: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-lifecycle-"));
    remote = mkdtempSync(join(tmpdir(), "vcs-remote-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    runGit("git init -b main", tmp);
    runGit("git init --bare", remote);
    runGit(`git remote add origin ${remote}`, tmp);
    runGit('git config user.name "test"', tmp);
    runGit('git config user.email "test@test"', tmp);
    runGit('git commit --allow-empty -m "init"', tmp);
    runGit("git push -u origin main", tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  });

  it("ships one clean remote commit in a real git repo", async () => {
    runGit("git checkout -b feat/002-second", tmp);

    writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 1;\n");
    runGit("git add tracked.ts", tmp);
    runGit('git commit -m "WIP: local"', tmp);

    writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 2;\n");
    writeFileSync(join(tmp, "new-file.ts"), "export const second = 2;\n");

    const execGit: ExecGit = async (args) => {
      const result = spawnSync("git", args, { cwd: tmp, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error((result.stderr || "").trim() || `git ${args[0]} failed`);
      }
      return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
    };

    const execCmd: ExecCmd = async (_cmd, args) => {
      if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
      throw new Error(`unexpected gh args: ${args.join(" ")}`);
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "002-second",
      branchName: "feat/002-second",
      baseBranch: "main",
      commitMessage: "feat: ship 002-second",
      prTitle: "Ship 002-second",
      prBody: "Resolves 002-second",
    });

    expect(runGit("git rev-list --count main..feat/002-second", tmp).trim()).toBe("1");

    const remoteBranchLog = runGit(`git --git-dir=${remote} log refs/heads/feat/002-second --oneline`, tmp);
    expect(remoteBranchLog).toContain("feat: ship 002-second");
    expect(remoteBranchLog).not.toContain("chore: finalize 002-second");
    expect(remoteBranchLog).not.toContain("WIP: local");

    expect(runGit(`git --git-dir=${remote} show refs/heads/feat/002-second:tracked.ts`, tmp)).toContain("export const tracked = 2;");
    expect(runGit(`git --git-dir=${remote} show refs/heads/feat/002-second:new-file.ts`, tmp)).toContain("export const second = 2;");

    expect(result).toEqual({ ok: true, finalized: true, pushed: true, pr: { ok: true, url: "https://github.com/org/repo/pull/42" } });
  });
});
