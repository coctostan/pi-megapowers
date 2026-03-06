---
id: 5
title: handleIssueCommand checks out main when on stale untracked feature branch
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - tests/vcs-commands.test.ts
files_to_create: []
---

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
