import { describe, it, expect } from "bun:test";
import {
  auditShipment,
  finalizeShipment,
  validateShipTarget,
  shipAndCreatePR,
} from "../extensions/megapowers/vcs/shipping.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";
describe("auditShipment", () => {
  it("calls one combined porcelain status audit and classifies tracked, untracked, and ignored files", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status" && args[1] === "--porcelain" && args[2] === "--untracked-files=all" && args[3] === "--ignored") {
        return {
          stdout: [
            " M extensions/megapowers/commands.ts",
            "?? extensions/megapowers/vcs/shipping.ts",
            "?? apps/web/.env.local",
            "!! coverage/index.html",
          ].join("\n"),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await auditShipment(execGit);

    expect(calls).toEqual([["status", "--porcelain", "--untracked-files=all", "--ignored"]]);
    expect(result).toEqual({
      tracked: ["extensions/megapowers/commands.ts"],
      includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
      ignoredUntracked: ["coverage/index.html"],
      blockedUntracked: ["apps/web/.env.local"],
    });
  });

  it("blocks suspicious untracked files, returns the blocked file list, and never stages or pushes", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") {
        return {
          stdout: [
            "?? .env.prod",
            "?? extensions/megapowers/vcs/shipping.ts",
          ].join("\n"),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await finalizeShipment(execGit, "093-vcs-lifecycle-audit-clean-commit-strateg");

    expect(result).toEqual({
      ok: false,
      error: "Blocked suspicious untracked files: .env.prod",
      blockedFiles: [".env.prod"],
    });
    expect(calls.some((c) => c[0] === "add")).toBe(false);
    expect(calls.some((c) => c[0] === "push")).toBe(false);
    expect(calls.some((c) => c[0] === "commit")).toBe(false);
  });

  it("rejects missing, empty, and base-branch ship targets before any push attempt", () => {
    expect(validateShipTarget(null, "main")).toEqual({ ok: false, error: "Cannot ship: branchName is missing." });
    expect(validateShipTarget("", "main")).toEqual({ ok: false, error: "Cannot ship: branchName is empty." });
    expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", null)).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
    expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "")).toEqual({ ok: false, error: "Cannot ship: baseBranch is missing." });
    expect(validateShipTarget("main", "main")).toEqual({ ok: false, error: "Cannot ship: branchName must differ from baseBranch (main)." });
    expect(validateShipTarget("feat/093-vcs-lifecycle-audit-clean-commit-strateg", "main")).toEqual({ ok: true });
  });

  it("runs the audit status first, then stages tracked and untracked files, then re-checks status before committing", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args.join(" ") === "status --porcelain --untracked-files=all --ignored") {
        return {
          stdout: [
            " M extensions/megapowers/commands.ts",
            "?? extensions/megapowers/vcs/shipping.ts",
            "!! coverage/index.html",
          ].join("\n"),
          stderr: "",
        };
      }
      if (args.join(" ") === "status --porcelain") {
        return {
          stdout: [
            "M  extensions/megapowers/commands.ts",
            "A  extensions/megapowers/vcs/shipping.ts",
          ].join("\n"),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await finalizeShipment(execGit, "093-vcs-lifecycle-audit-clean-commit-strateg");

    expect(result).toEqual({
      ok: true,
      committed: true,
      audit: {
        tracked: ["extensions/megapowers/commands.ts"],
        includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
        ignoredUntracked: ["coverage/index.html"],
        blockedUntracked: [],
      },
    });

    expect(calls[0]).toEqual(["status", "--porcelain", "--untracked-files=all", "--ignored"]);
    expect(calls).toContainEqual(["add", "-u"]);
    const untrackedAdds = calls.filter((c) => c[0] === "add" && c[1] === "--");
    expect(untrackedAdds).toEqual([["add", "--", "extensions/megapowers/vcs/shipping.ts"]]);
    expect(calls).toContainEqual(["status", "--porcelain"]);
    expect(calls).toContainEqual(["commit", "-m", "chore: finalize 093-vcs-lifecycle-audit-clean-commit-strateg"]);

  });

  it("returns a validate error before finalize, squash, push, or PR work", async () => {
    const gitCalls: string[][] = [];
    let ghCalled = false;

    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async () => {
      ghCalled = true;
      return { stdout: "", stderr: "" };
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "main",
      baseBranch: "main",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
    });

    expect(result).toEqual({
      ok: false,
      step: "validate",
      error: "Cannot ship: branchName must differ from baseBranch (main).",
      pushed: false,
    });
    expect(gitCalls).toEqual([]);
    expect(ghCalled).toBe(false);
  });

  it("returns the same validate short-circuit for a captured non-main base branch", async () => {
    const gitCalls: string[][] = [];
    let ghCalled = false;

    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async () => {
      ghCalled = true;
      return { stdout: "", stderr: "" };
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "release/2026.03",
      baseBranch: "release/2026.03",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
    });

    expect(result).toEqual({
      ok: false,
      step: "validate",
      error: "Cannot ship: branchName must differ from baseBranch (release/2026.03).",
      pushed: false,
    });
    expect(gitCalls).toEqual([]);
    expect(ghCalled).toBe(false);
  });

  it("runs finalize and push before checking gh availability for PR creation", async () => {
    const events: string[] = [];

    const execGit: ExecGit = async (args) => {
      events.push(`git ${args.join(" ")}`);
      if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
      if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    };
    const execCmd: ExecCmd = async (cmd, args) => {
      events.push(`${cmd} ${args.join(" ")}`);
      throw new Error("command not found: gh");
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
    });

    expect(result).toEqual({
      ok: true,
      finalized: false,
      pushed: true,
      pr: { skipped: true, reason: "gh CLI not installed" },
    });

    expect(events).toEqual([
      "git status --porcelain --untracked-files=all --ignored",
      "git reset --soft main",
      "git status --porcelain",
      "git push origin feat/093-vcs-lifecycle-audit-clean-commit-strateg --force-with-lease",
      "gh --version",
    ]);
  });

  it("returns push failure and does not attempt PR creation", async () => {
    let prAttempted = false;
    const execCmd: ExecCmd = async () => {
      prAttempted = true;
      return { stdout: "", stderr: "" };
    };

    const execGit: ExecGit = async (args) => {
      if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
      if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
      if (args[0] === "push") throw new Error("remote rejected");
      return { stdout: "", stderr: "" };
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
    });

    expect(result).toEqual({
      ok: false,
      step: "push",
      error: "remote rejected",
      pushed: false,
    });
    expect(prAttempted).toBe(false);
  });

  it("returns a finalize error and does not attempt push or PR when finalization blocks shipment", async () => {
    const gitCalls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      if (args[0] === "status" && args.includes("--ignored")) {
        return { stdout: "?? .env.local\n", stderr: "" };
      }
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    };

    let prAttempted = false;
    const execCmd: ExecCmd = async () => {
      prAttempted = true;
      return { stdout: "", stderr: "" };
    };

    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "Ship 093",
      prBody: "Resolves 093",
    });

    expect(result).toEqual({
      ok: false,
      step: "finalize",
      error: "Blocked suspicious untracked files: .env.local",
      blockedFiles: [".env.local"],
      pushed: false,
    });
    expect(gitCalls).toEqual([["status", "--porcelain", "--untracked-files=all", "--ignored"]]);
    expect(gitCalls.some((c) => c[0] === "push")).toBe(false);
    expect(prAttempted).toBe(false);
    // Explicit guard verification: PR executor was never invoked after finalize abort.
    expect(prAttempted).toBe(false);
  });

  it("returns a targeted PR error while preserving the earlier successful push result", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status" && args.includes("--ignored")) return { stdout: "", stderr: "" };
      if (args[0] === "status" && !args.includes("--ignored")) return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    };
    const execCmd: ExecCmd = async (_cmd, args) => {
      if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
      throw new Error("authentication required");
    };
    const result = await shipAndCreatePR({
      execGit,
      execCmd,
      issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
      commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
      prTitle: "Ship 093",
      prBody: "Resolves 093",
    });
    expect(result).toEqual({
      ok: false,
      step: "pr",
      error: "authentication required",
      pushed: true,
      pr: { ok: false, error: "authentication required" },
    });
  });
});
