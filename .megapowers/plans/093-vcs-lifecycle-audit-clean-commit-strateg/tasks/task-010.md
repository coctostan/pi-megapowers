---
id: 10
title: Update the done prompt to call the code-owned shipping helper
status: approved
depends_on:
  - 9
no_test: false
files_to_modify:
  - prompts/done.md
files_to_create:
  - extensions/megapowers/vcs/ship-cli.ts
  - tests/done-prompt.test.ts
---

### Task 10: Update the done prompt to call the code-owned shipping helper [depends: 9]

**Files:**
- Create: `extensions/megapowers/vcs/ship-cli.ts`
- Create: `tests/done-prompt.test.ts`
- Modify: `prompts/done.md`
- Test: `tests/done-prompt.test.ts`

**Step 1 — Write the failing test**
`buildInjectedPrompt()` is an existing helper exported by `extensions/megapowers/prompt-inject.ts`; this task verifies the done-prompt wiring through that existing integration point.
No change to `extensions/megapowers/prompt-inject.ts` is required in this task; the test imports and exercises that existing export directly.
This task verifies prompt routing only; CLI state loading (`readState` in `ship-cli.ts`) is intentionally unit-covered in Task 18.
Keep the assertion set focused on both command wiring and preserved prompt structure (header + checklist + push-and-pr section) so formatting regressions are caught.
Create `tests/done-prompt.test.ts`:

```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/done-prompt.test.ts -t "routes push-and-pr through the stable ship-cli entrypoint instead of raw git push"`
Expected: FAIL — `expect(received).toContain(expected)` because the prompt still contains the raw push/PR instructions

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/vcs/ship-cli.ts` as shown below, then update only the `push-and-pr` action block in `prompts/done.md`.

This task owns the initial `ship-cli.ts` entrypoint and **only** the `### push-and-pr` block in `prompts/done.md`. Preserve the entire rest of `prompts/done.md` structure verbatim. Task 18 should only add direct unit coverage to this already-exported helper without changing prompt ownership.

The current `prompts/done.md` file already contains both boundary headings:
- `### push-and-pr` at the current block starting around line 60
In the current file revision, that block spans approximately lines 60–89; treat those as the edit window and re-check with `read("prompts/done.md", { offset: 60, limit: 35 })` before replacing.
- `### close-issue` at the next block starting around line 90

Replace the entire existing block from the `### push-and-pr` heading through the cleanup reminder immediately before `### close-issue`. Do not modify any earlier headings, any earlier action instructions, or the entire `### close-issue` section.
Exact current block markers in `prompts/done.md`:
- Start marker line: `### push-and-pr`
- First line inside old block: `Push the feature branch and create a PR:`
- End marker boundary: the closing code fence of the cleanup reminder block immediately above `### close-issue`.
If the template ever contains multiple similarly worded reminders, use the `### push-and-pr` section that is immediately followed later by `### close-issue` in the same Action Instructions block.
These markers define the replacement boundary and should be matched verbatim before editing.
To avoid boundary mistakes, first inspect that exact region before editing:
```ts
read("prompts/done.md", { offset: 60, limit: 35 })
```
Then replace only from `### push-and-pr` through the cleanup reminder line immediately above `### close-issue`.

Create `extensions/megapowers/vcs/ship-cli.ts`:

```ts
import { readState } from "../state/state-io.js";
import { shipAndCreatePR } from "./shipping.js";

export function buildShipRequest(state: { activeIssue: string | null; branchName: string | null; baseBranch: string | null }) {
  return {
    issueSlug: state.activeIssue ?? "",
    branchName: state.branchName,
    baseBranch: state.baseBranch,
    commitMessage: `feat: ship ${state.activeIssue ?? "issue"}`,
    prTitle: `Ship ${state.activeIssue ?? "issue"}`,
    prBody: `Resolves ${state.activeIssue ?? "issue"}`,
  };
}

if (import.meta.main) {
  const state = readState(process.cwd());
  const request = buildShipRequest(state);
  const execGit = async (args: string[]) => {
    const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`);
    return { stdout, stderr };
  };
  const execCmd = async (cmd: string, args: string[]) => {
    const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `${cmd} ${args[0]} failed`);
    return { stdout, stderr };
  };
  const result = await shipAndCreatePR({ execGit, execCmd, ...request });
  console.log(JSON.stringify(result, null, 2));
}
```
`buildShipRequest()` must return exactly: `{ issueSlug, branchName, baseBranch, commitMessage, prTitle, prBody }` so spreading into `shipAndCreatePR({ execGit, execCmd, ...request })` matches Task 9’s `ShipRequest` shape.

Use this exact replacement content for the prompt section:

```md
### push-and-pr
Ship the current issue through the code-owned VCS lifecycle helper. Do not run raw `git push` or `gh pr create` commands yourself.

Run:
```bash
bun extensions/megapowers/vcs/ship-cli.ts
```

Interpret the JSON result from that command as follows:
- if finalization blocks suspicious files, stop and report the blocked file list
- if push fails, do not attempt PR creation
- if PR is skipped because `gh` is unavailable, report that push succeeded and PR must be created manually
- after a successful ship result, print the cleanup reminder

After your PR is merged on GitHub, run these cleanup commands:
```
git checkout main && git pull && git branch -d {{branch_name}}
```
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/done-prompt.test.ts -t "routes push-and-pr through the stable ship-cli entrypoint instead of raw git push"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
