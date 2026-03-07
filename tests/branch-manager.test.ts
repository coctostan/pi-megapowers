import { describe, it, expect } from "bun:test";
import { ensureBranch, switchAwayCommit, squashAndPush, squashBranchToSingleCommit } from "../extensions/megapowers/vcs/branch-manager.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("ensureBranch", () => {
  it("creates feat/ branch for feature workflow and returns branchName only (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "my-feature", "feature");
    expect(result).toEqual({ branchName: "feat/my-feature" });
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "-b" && c[2] === "feat/my-feature" && c[3] === "HEAD")).toBe(true);
    expect(calls.some((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref")).toBe(false);
  });

  it("creates fix/ branch for bugfix workflow (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };
    const result = await ensureBranch(execGit, "broken-login", "bugfix");
    expect(result).toEqual({ branchName: "fix/broken-login" });
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "-b" && c[2] === "fix/broken-login" && c[3] === "HEAD")).toBe(true);
  });

  it("checks out existing branch without creating (AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "existing", "feature");
    expect(result).toEqual({ branchName: "feat/existing" });
    expect(calls.some(c => c[0] === "checkout" && c.length === 2 && c[1] === "feat/existing")).toBe(true);
    expect(calls.some(c => c[1] === "-b")).toBe(false);
  });

  it("returns error when not in a git repo (AC21)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--git-dir") throw new Error("not a git repo");
      return { stdout: "", stderr: "" };
    };

    const result = await ensureBranch(execGit, "my-feature", "feature");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("VCS features are unavailable");
    }
  });
});

describe("switchAwayCommit", () => {
  it("performs WIP commit with branch name in message (AC9)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/old-feature")).toBe(true);
  });

  it("returns committed: false when working tree is clean (AC9)", async () => {
    const execGit: ExecGit = async () => {
      return { stdout: "", stderr: "" };
    };

    const result = await switchAwayCommit(execGit, "feat/old-feature");
    expect(result).toEqual({ ok: true, committed: false });
  });
});

describe("squashAndPush", () => {
  it("soft-resets onto the base branch and writes one clean squash commit", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashBranchToSingleCommit(execGit, "main", "feat: ship 093");

    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
      ["commit", "-m", "feat: ship 093"],
    ]);
  });
  it("squashes onto base and force-pushes on success (AC10)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: true });
    expect(calls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    expect(calls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
  });

  it("returns step: squash when squash fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "reset failed", step: "squash" });
  });

  it("returns step: push when push fails (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "push") throw new Error("remote rejected");
      return { stdout: "", stderr: "" };
    };

    const result = await squashAndPush(execGit, "feat/x", "main", "feat: done");
    expect(result).toEqual({ ok: false, error: "remote rejected", step: "push" });
  });
});
