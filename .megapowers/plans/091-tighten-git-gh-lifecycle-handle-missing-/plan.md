# Plan

### Task 1: checkBranchSync returns hasRemote false when no remote configured

### Task 1: checkBranchSync returns hasRemote false when no remote configured

**Files:**
- Create: `extensions/megapowers/vcs/sync-check.ts`
- Create: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/sync-check.test.ts
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
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/vcs/sync-check.js"`

**Step 3 — Write minimal implementation**

```typescript
// extensions/megapowers/vcs/sync-check.ts
import type { ExecGit } from "./git-ops.js";

export type BranchSyncStatus = {
  hasRemote: boolean;
  behind: number;
  ahead: number;
};

export async function checkBranchSync(
  execGit: ExecGit,
  baseBranch: string,
): Promise<BranchSyncStatus> {
  // Check if any remote is configured
  try {
    const remoteResult = await execGit(["remote"]);
    if (!remoteResult.stdout.trim()) {
      return { hasRemote: false, behind: 0, ahead: 0 };
    }
  } catch {
    return { hasRemote: false, behind: 0, ahead: 0 };
  }

  // Fetch from origin
  try {
    await execGit(["fetch", "origin"]);
  } catch {
    // Fail-open: treat as in-sync if fetch fails
    return { hasRemote: true, behind: 0, ahead: 0 };
  }

  // Compare local vs remote
  try {
    const result = await execGit([
      "rev-list", "--left-right", "--count",
      `${baseBranch}...origin/${baseBranch}`,
    ]);
    const parts = result.stdout.trim().split(/\s+/);
    const ahead = parseInt(parts[0] ?? "0", 10) || 0;
    const behind = parseInt(parts[1] ?? "0", 10) || 0;
    return { hasRemote: true, behind, ahead };
  } catch {
    return { hasRemote: true, behind: 0, ahead: 0 };
  }
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 2: checkBranchSync returns in-sync when local matches remote [depends: 1]

### Task 2: checkBranchSync returns in-sync when local matches remote [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This test should pass immediately since the implementation from Task 1 already handles this case. This is a verification test.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already handles this correctly via `rev-list --left-right --count`.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 2 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 3: checkBranchSync returns correct behind count when local is behind remote [depends: 1]

### Task 3: checkBranchSync returns correct behind count when local is behind remote [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
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
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This test should pass with existing implementation since rev-list parsing is already in place.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already parses the `rev-list --left-right --count` output correctly.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 3 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: checkBranchSync fails open when git fetch fails [depends: 1]

### Task 4: checkBranchSync fails open when git fetch fails [depends: 1]

**Files:**
- Modify: `tests/sync-check.test.ts`

**Step 1 — Write the failing test**

Add to `tests/sync-check.test.ts` inside the `describe("checkBranchSync", ...)` block:

```typescript
  it("returns hasRemote true, behind 0 when fetch fails — fail-open (AC6)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") throw new Error("Could not resolve host");
      return { stdout: "", stderr: "" };
    };

    const result = await checkBranchSync(execGit, "main");
    expect(result).toEqual({ hasRemote: true, behind: 0, ahead: 0 });
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — This should pass with the existing implementation since Task 1 already catches fetch errors.

**Step 3 — Write minimal implementation**

No code changes needed — the implementation from Task 1 already catches fetch errors and returns fail-open.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/sync-check.test.ts`
Expected: PASS — 4 tests passing

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: handleIssueCommand checks out main when on stale untracked feature branch [depends: 1]

### Task 5: handleIssueCommand checks out main when on stale untracked feature branch [depends: 1]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

Add a new `describe` block to `tests/vcs-commands.test.ts`:

```typescript
describe("handleIssueCommand — stale branch detection (AC1)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-stale-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("checks out main when on feat/* branch with no state.branchName (AC1)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "feat/old-issue\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    // State has no branchName — simulates post-close_issue state
    writeState(tmp, createInitialState());

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-feature"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should have checked out main before proceeding
    expect(calls.some(c => c[0] === "checkout" && c[1] === "main")).toBe(true);
    // The checkout main should come BEFORE the ensureBranch checkout -b
    const checkoutMainIdx = calls.findIndex(c => c[0] === "checkout" && c[1] === "main");
    const createBranchIdx = calls.findIndex(c => c[0] === "checkout" && c[1] === "-b");
    expect(checkoutMainIdx).toBeLessThan(createBranchIdx);
  });

  it("does NOT checkout main when on main already (no branchName in state)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, createInitialState());

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-feature"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should NOT have a plain checkout main (only checkout -b for new branch)
    expect(calls.some(c => c[0] === "checkout" && c.length === 2 && c[1] === "main")).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — `expect(received).toBe(true)` — no `checkout main` call found because `handleIssueCommand` doesn't detect stale branches yet.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/commands.ts`, add the stale branch detection to `handleIssueCommand`. Add import at top:

```typescript
import { checkBranchSync } from "./vcs/sync-check.js";
```

Then modify the VCS block inside `handleIssueCommand` (after the `switchAwayCommit` section, before the `baseBranch` capture). Replace the `baseBranch` capture block (lines 78-87) with:

```typescript
    let baseBranch: string | null = null;
    if (prevState.branchName) {
      // Already on a feature branch — preserve the known base
      baseBranch = prevState.baseBranch;
    } else {
      // Fresh activation — detect stale feature branch
      try {
        const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
        const currentBranch = r.stdout.trim();
        // If on a feat/* or fix/* branch with no state tracking it, checkout main
        if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
          await deps.execGit(["checkout", "main"]);
          baseBranch = "main";
        } else {
          baseBranch = currentBranch || null;
        }
      } catch { /* ignore — baseBranch stays null */ }
    }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 6: handleIssueCommand prompts user when local main is behind remote [depends: 1, 5]

### Task 6: handleIssueCommand prompts user when local main is behind remote [depends: 1, 5]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

Add a new `describe` block to `tests/vcs-commands.test.ts`:

```typescript
describe("handleIssueCommand — remote sync check (AC7/AC8/AC9/AC10)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-sync-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("prompts user and pulls when behind remote and user selects 'Pull latest' (AC7/AC8)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t3\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, createInitialState());

    let selectCalled = false;
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("003-new-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: () => {},
        select: async () => {
          selectCalled = true;
          return "Pull latest (recommended)";
        },
      },
    };
    await handleIssueCommand("list", ctx, deps);

    expect(selectCalled).toBe(true);
    expect(calls.some(c => c[0] === "pull")).toBe(true);
  });

  it("skips pull when user selects 'Use local as-is' (AC9)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t3\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, createInitialState());

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("003-new-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: () => {},
        select: async () => "Use local as-is",
      },
    };
    await handleIssueCommand("list", ctx, deps);

    expect(calls.some(c => c[0] === "pull")).toBe(false);
  });

  it("proceeds silently when local is in sync with remote — no prompt (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "origin\n", stderr: "" };
      if (args[0] === "fetch") return { stdout: "", stderr: "" };
      if (args[0] === "rev-list") return { stdout: "0\t0\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, createInitialState());

    let selectCalled = false;
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("003-new-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: () => {},
        select: async () => { selectCalled = true; return "Pull latest (recommended)"; },
      },
    };
    await handleIssueCommand("list", ctx, deps);

    expect(selectCalled).toBe(false);
  });

  it("proceeds silently when no remote — no prompt (AC10)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      if (args[0] === "remote") return { stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, createInitialState());

    let selectCalled = false;
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("003-new-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: () => {},
        select: async () => { selectCalled = true; return "Pull latest (recommended)"; },
      },
    };
    await handleIssueCommand("list", ctx, deps);

    expect(selectCalled).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — `expect(received).toBe(true)` for `selectCalled` — `handleIssueCommand` doesn't call `checkBranchSync` or prompt the user yet.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/commands.ts`, update the fresh-activation block inside `handleIssueCommand`. After the stale branch detection from Task 5, add the sync check. The full replacement for the `else` branch (fresh activation, no `prevState.branchName`):

```typescript
    } else {
      // Fresh activation — detect stale feature branch and sync with remote
      try {
        const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
        const currentBranch = r.stdout.trim();
        // If on a feat/* or fix/* branch with no state tracking it, checkout main
        if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
          await deps.execGit(["checkout", "main"]);
          baseBranch = "main";
        } else {
          baseBranch = currentBranch || null;
        }
      } catch { /* ignore — baseBranch stays null */ }

      // Check if local base is behind remote
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
```

Make sure the import for `checkBranchSync` is at the top (added in Task 5):
```typescript
import { checkBranchSync } from "./vcs/sync-check.js";
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 7: Update done.md prompt with gh CLI checks, checkout main, and cleanup guidance [no-test]

### Task 7: Update done.md prompt with gh CLI checks, checkout main, and cleanup guidance [no-test]

**Justification:** Prompt-only change — no observable behavior in code to test. The done prompt is a markdown template consumed by the LLM.

**Files:**
- Modify: `prompts/done.md`

**Step 1 — Make the change**

Replace the `### push-and-pr` section (lines 60-68) in `prompts/done.md` with:

```markdown
### push-and-pr
Push the feature branch and create a PR:

**Step 1 — Push the branch:**
```
bash("git push origin {{branch_name}}")
```

**Step 2 — Check GitHub CLI availability:**
```
bash("which gh && gh auth status")
```

- If `gh` is **not installed**: Ask the user if they'd like help installing it (e.g., `brew install gh`). If they decline, skip PR creation and tell them: "Push succeeded. Create your PR manually at the GitHub repo page."
- If `gh` is installed but **not authenticated**: Ask the user if they'd like to run `gh auth login`. If they decline, skip PR creation with the same message.
- If both checks pass: proceed to Step 3.

**Step 3 — Create the PR:**
```
bash("gh pr create --base {{base_branch}} --head {{branch_name}} --title '<issue title>' --body 'Resolves {{issue_slug}}'")
```

If `{{branch_name}}` is empty or the push fails, report the error and move on — do not block other actions.
After push+PR (or after any errors), tell the user:

> After your PR is merged on GitHub, run these cleanup commands:
> ```
> git checkout main && git pull && git branch -d {{branch_name}}
> ```
```

Replace the `### close-issue` section (lines 70-75) with:

```markdown
### close-issue
All other actions are complete. Before closing:
1. Run `git checkout main` to return to the base branch — do not leave the user on the feature branch.
2. Then call the close_issue signal:
```
megapowers_signal({ action: "close_issue" })
```
This resets the workflow state. Do NOT call phase_next — use close_issue.
```

**Step 2 — Verify**
Run: `bun test tests/prompt-inject.test.ts`
Expected: all passing — prompt template changes don't break injection tests since they test template interpolation, not content.

Also manually verify: `cat prompts/done.md` and confirm the `gh auth status`, cleanup guidance, and `git checkout main` instructions are present.
