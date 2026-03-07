---
id: 15
title: Extend VCS coverage with a real-git shipping regression
status: approved
depends_on:
  - 9
  - 13
no_test: false
files_to_modify: []
files_to_create:
  - tests/vcs-lifecycle-integration.test.ts
---

### Task 15: Extend VCS coverage with a real-git shipping regression [depends: 9, 13]
**Covers:** AC18

**Files:**
- Create: `tests/vcs-lifecycle-integration.test.ts`
- Test: `tests/vcs-lifecycle-integration.test.ts`

**Step 1 — Write the failing test**
Create `tests/vcs-lifecycle-integration.test.ts`:

```ts
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
```

Use `spawnSync("git", args, ...)` for the injected `execGit` wrapper. Do **not** build git commands with `args.join(" ")`, because this test sends commit messages with spaces.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-lifecycle-integration.test.ts -t "ships one clean remote commit in a real git repo"`
Expected: FAIL — before finalization+squash are wired correctly end-to-end, the remote-history assertions fail because the shipped branch still contains `WIP: local` or `chore: finalize 002-second`, or the remote tree is missing the final dirty files.

**Step 3 — Write minimal implementation**
No new production module is required beyond Tasks 9 and 13. Wire those helpers together exactly as described in earlier tasks so this regression passes:

```ts
// ship -> validateShipTarget() -> finalizeShipment() -> squashAndPush() -> createPR()
```

This task is intentionally narrower than the unit suites: it complements the earlier `shipping`, `branch-manager`, and `pr-creator` tests by proving that a real git repo ends up with one clean shipped commit on the remote, with final tracked and untracked file content present and no leaked intermediate history.
AC18 mapping note: this real-git regression complements unit coverage by proving remote history collapses to one clean shipped commit and that final tracked/untracked file content is present on the remote branch.

If any helper signatures diverged while implementing earlier tasks, reconcile them now so this integration test uses the final public API:
- `shipAndCreatePR({ execGit, execCmd, issueSlug, branchName, baseBranch, commitMessage, prTitle, prBody })`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-lifecycle-integration.test.ts -t "ships one clean remote commit in a real git repo"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
