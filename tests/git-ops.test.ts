import { describe, it, expect } from "bun:test";
import { createBranch, checkoutBranch, wipCommit, squashOnto, pushBranch, type ExecGit, type WipCommitResult, type SquashResult } from "../extensions/megapowers/vcs/git-ops.js";

describe("createBranch", () => {
  it("calls git checkout -b with branch name and base branch", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await createBranch(execGit, "feat/my-feature", "main");
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["checkout", "-b", "feat/my-feature", "main"]]);
  });

  it("returns ok: false with error message when git fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("branch already exists");
    };

    const result = await createBranch(execGit, "feat/my-feature", "main");
    expect(result).toEqual({ ok: false, error: "branch already exists" });
  });
});

describe("checkoutBranch", () => {
  it("calls git checkout with branch name", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await checkoutBranch(execGit, "feat/my-feature");
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["checkout", "feat/my-feature"]]);
  });

  it("returns ok: false with error message when git fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("pathspec 'feat/missing' did not match");
    };

    const result = await checkoutBranch(execGit, "feat/missing");
    expect(result).toEqual({ ok: false, error: "pathspec 'feat/missing' did not match" });
  });
});

describe("wipCommit", () => {
  it("stages all, checks status, and commits when there are changes (AC4)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["add", "-A"],
      ["status", "--porcelain"],
      ["commit", "-m", "WIP: test"],
    ]);
  });

  it("returns committed: false when working tree is clean (AC4)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: true, committed: false });
    expect(calls).toEqual([
      ["add", "-A"],
      ["status", "--porcelain"],
    ]);
  });

  it("returns ok: false when git commit fails (AC23)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "commit") throw new Error("commit failed");
      return { stdout: "", stderr: "" };
    };

    const result = await wipCommit(execGit, "WIP: test");
    expect(result).toEqual({ ok: false, error: "commit failed" });
  });
});

describe("squashOnto", () => {
  it("performs soft reset and commits when there are changes (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete feature");
    expect(result).toEqual({ ok: true, committed: true });
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
      ["commit", "-m", "feat: complete feature"],
    ]);
  });

  it("returns committed: false when nothing to commit after reset (AC5)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: true, committed: false });
    expect(calls).toEqual([
      ["reset", "--soft", "main"],
      ["status", "--porcelain"],
    ]);
  });

  it("returns ok: false when reset fails (AC23)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed: ambiguous argument");
      return { stdout: "", stderr: "" };
    };

    const result = await squashOnto(execGit, "main", "feat: complete");
    expect(result).toEqual({ ok: false, error: "reset failed: ambiguous argument" });
  });
});

describe("pushBranch", () => {
  it("pushes to origin without force flag (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature"]]);
  });

  it("pushes with --force-with-lease when force is true (AC6)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };

    const result = await pushBranch(execGit, "feat/my-feature", true);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([["push", "origin", "feat/my-feature", "--force-with-lease"]]);
  });

  it("returns ok: false when push fails (AC23)", async () => {
    const execGit: ExecGit = async () => {
      throw new Error("remote: permission denied");
    };

    const result = await pushBranch(execGit, "feat/my-feature", false);
    expect(result).toEqual({ ok: false, error: "remote: permission denied" });
  });
});
