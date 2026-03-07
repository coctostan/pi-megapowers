import { describe, it, expect } from "bun:test";
import { buildShipRequest, runShipCli } from "../extensions/megapowers/vcs/ship-cli.js";

describe("ship-cli", () => {
  it("builds a stable ship request and passes it through the CLI runner", async () => {
    const state = {
      activeIssue: "093-vcs-lifecycle-audit-clean-commit-strateg",
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
    } as any;

    const logs: string[] = [];
    const result = await runShipCli(state, {
      execGit: async () => ({ stdout: "", stderr: "" }),
      execCmd: async () => ({ stdout: "", stderr: "" }),
      ship: async (request) => {
        expect(request).toEqual({
          ...buildShipRequest(state),
          execGit: expect.any(Function),
          execCmd: expect.any(Function),
        });
        expect(request.issueSlug).toBe("093-vcs-lifecycle-audit-clean-commit-strateg");
        expect(request.branchName).toBe("feat/093-vcs-lifecycle-audit-clean-commit-strateg");
        expect(request.baseBranch).toBe("main");
        return { ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } } as const;
      },
      log: (line: string) => logs.push(line),
    });

    expect(result).toEqual({ ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } });
    expect(logs).toEqual([
      JSON.stringify({ ok: true, finalized: false, pushed: true, pr: { skipped: true, reason: "gh CLI not installed" } }, null, 2),
    ]);
  });
});
