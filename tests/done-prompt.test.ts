import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildInjectedPrompt } from "../extensions/megapowers/prompt-inject.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

describe("done prompt shipping instructions", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "done-prompt-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "093-vcs-lifecycle-audit-clean-commit-strateg",
      workflow: "feature",
      phase: "done",
      megaEnabled: true,
      doneActions: ["push-and-pr"],
      branchName: "feat/093-vcs-lifecycle-audit-clean-commit-strateg",
      baseBranch: "main",
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("routes push-and-pr through the stable ship-cli entrypoint instead of raw git push", () => {
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("bun extensions/megapowers/vcs/ship-cli.ts");
    expect(result).toContain("Do not run raw `git push` or `gh pr create` commands yourself");
    expect(result).toContain("if push fails, do not attempt PR creation");
    expect(result).not.toContain("git push origin {{branch_name}}");
    expect(result).not.toContain("gh pr create --base {{base_branch}}");
  });
});
