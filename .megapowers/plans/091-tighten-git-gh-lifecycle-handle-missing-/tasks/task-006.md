---
id: 6
title: handleIssueCommand prompts user when local main is behind remote
status: approved
depends_on:
  - 1
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - tests/vcs-commands.test.ts
files_to_create: []
---

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
