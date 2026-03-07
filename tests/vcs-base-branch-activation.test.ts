import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleIssueCommand, resolveActivationBaseBranch } from "../extensions/megapowers/commands.js";
import { readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

function makeMockUI(newActiveIssue: string) {
  return {
    handleIssueCommand: async () => ({
      ...createInitialState(),
      activeIssue: newActiveIssue,
      workflow: "feature" as const,
      phase: "brainstorm" as const,
    }),
    renderDashboard: () => {},
    updateStatus: () => {},
    handleTriageCommand: async (s: any) => s,
  };
}

describe("activation base-branch capture", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-base-branch-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior", async () => {
    const calls: string[][] = [];
    const headSequence = ["feat/orphan\n", "release/2026.03\n"] as const;
    // Explicit sequence avoids ambiguous counter logic while still exercising both code paths.
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
        return { stdout: headSequence[Math.min(calls.filter((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref").length - 1, 1)], stderr: "" };
      }
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t2\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    const resolved = await resolveActivationBaseBranch(execGit);
    expect(resolved).toBe("main");
    expect(calls.some((c) => c[0] === "checkout" && c[1] === "main")).toBe(true);

    let selectCalled = false;
    await handleIssueCommand(
      "list",
      {
        cwd: tmp,
        hasUI: true,
        ui: {
          notify: () => {},
          select: async () => {
            selectCalled = true;
            return "Use local as-is";
          },
        },
      } as any,
      {
        store: { listIssues: () => [] } as any,
        ui: makeMockUI("003-release-fix"),
        execGit,
      } as any,
    );

    expect(selectCalled).toBe(true);
    expect(calls.some((c) => c[0] === "pull")).toBe(false);
    expect(readState(tmp)).toMatchObject({
      baseBranch: "release/2026.03",
      branchName: "feat/003-release-fix",
    });
    // `baseBranch` is later threaded into shipAndCreatePR for shipping operations.
  });
});
