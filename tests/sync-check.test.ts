import { describe, it, expect } from "bun:test";
import { checkBranchSync } from "../extensions/megapowers/vcs/sync-check.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

describe("checkBranchSync", () => {
  it("returns hasRemote false when git remote produces no output (AC3)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: false, behind: 0, ahead: 0 });
  });

  it("returns hasRemote true, behind 0, ahead 0 when local and remote are identical (AC4)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t0\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 0, ahead: 0 });
  });

  it("returns correct behind count when local is behind origin (AC5)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t3\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 3, ahead: 0 });
  });

  it("returns hasRemote true, behind 0 when fetch fails — fail-open (AC6)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") throw new Error("Could not resolve host");
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 0, ahead: 0 });
  });
});
