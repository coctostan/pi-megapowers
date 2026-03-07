---
id: 16
title: Record a non-feature base branch during activation
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
files_to_create:
  - tests/vcs-base-branch-activation.test.ts
---

### Task 16: Record a non-feature base branch during activation [depends: 2]

**Covers:** AC1, AC2

**Files:**
AC1-specific assertion in this task: successful activation persists `branchName` (e.g., `feat/003-release-fix`) to state.
- Create: `tests/vcs-base-branch-activation.test.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/vcs-base-branch-activation.test.ts`

**Step 1 — Write the failing test**
Create `tests/vcs-base-branch-activation.test.ts`:

```ts
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-base-branch-activation.test.ts -t "records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior"`
Expected: FAIL — `SyntaxError: Export named 'resolveActivationBaseBranch' not found in module '../extensions/megapowers/commands.js'`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/commands.ts`, extract helper logic from the existing fresh-activation branch handling:
This is a **new exported helper** from `commands.ts` (not previously exported), so the test import path is valid only after this task's implementation.

```ts
export async function resolveActivationBaseBranch(execGit: ExecGit): Promise<string | null> {
  try {
    const r = await execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
      await execGit(["checkout", "main"]);
      return "main";
    }
    return currentBranch || null;
  } catch {
    return null;
  }
}
```

Then update the fresh activation path in `handleIssueCommand()` to use the helper but keep the existing sync prompt flow afterward:

```ts
let baseBranch: string | null = null;
if (prevState.branchName) {
  baseBranch = prevState.baseBranch;
} else {
  baseBranch = await resolveActivationBaseBranch(deps.execGit);

  if (baseBranch && deps.execGit) {
    const syncStatus = await checkBranchSync(deps.execGit, baseBranch);
    if (syncStatus.hasRemote && syncStatus.behind > 0 && ctx.hasUI && ctx.ui.select) {
      const choice = await ctx.ui.select(
        `Local \`${baseBranch}\` is ${syncStatus.behind} commit(s) behind remote.`,
        ["Pull latest (recommended)", "Use local as-is"],
      );
      if (choice === "Pull latest (recommended)") {
        try {
          await deps.execGit(["pull"]);
        } catch (err: any) {
          if (ctx.hasUI) ctx.ui.notify(`VCS: git pull failed: ${err?.message}`, "error");
        }
      }
    }
  }
}

const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
if ("branchName" in result) {
  newState.branchName = result.branchName;
  newState.baseBranch = baseBranch;
  // Equality validation is enforced at ship time by Task 5/9 (`validateShipTarget`).
```
Keep the existing persistence call after this block:
```ts
writeState(ctx.cwd, newState);
```
so `readState(tmp)` assertions in the test observe `branchName/baseBranch` updates.

Do not remove stale-branch cleanup or sync prompting.
`resolveActivationBaseBranch()` behavior is branch-sensitive: `feat/*`/`fix/*` -> checkout `main`; non-feature branches (e.g. `release/2026.03`) -> returned as-is. The two mocked HEAD values intentionally exercise both code paths.
The test intentionally uses two `rev-parse --abbrev-ref HEAD` responses from different call sites: one for stale feature-branch cleanup (`feat/orphan` → checkout `main`), and a later fresh activation capture (`release/2026.03`).
This project standardizes on `main` (existing command tests and done-phase behavior already assume it), so the helper keeps explicit `checkout main` semantics for stale `feat/*`/`fix/*` cleanup.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-base-branch-activation.test.ts -t "records branchName/baseBranch on activation success (AC1/AC2) while preserving stale-feature cleanup behavior"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
