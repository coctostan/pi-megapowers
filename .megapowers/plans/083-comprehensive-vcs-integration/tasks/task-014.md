---
id: 14
title: Done action handler for push-and-pr
status: approved
depends_on:
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - extensions/megapowers/hooks.ts
  - tests/hooks.test.ts
files_to_create: []
---

### Task 14: Done action handler for push-and-pr [depends: 8, 9, 10, 11, 12, 13]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `extensions/megapowers/hooks.ts`
- Modify: `tests/hooks.test.ts`

**Step 1 — Write the failing test**

Add to `tests/hooks.test.ts`:

First, add required imports at the top of `tests/hooks.test.ts`:
```typescript
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";
```

**Note on `state.baseBranch`:** Tests set `baseBranch: "main"` in the initial state. This field is captured
at issue-activation time (Task 12). For graceful degradation, if `baseBranch` is missing we **notify error**
and **consume** the action (so done-phase completion is never blocked).

Then add these test cases:

```typescript
describe("onAgentEnd — push-and-pr done action (AC18, AC19, AC20)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-pr-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("AC18: calls squashAndPush then createPR and removes action on success", async () => {
    const gitCalls: string[][] = [];
    const cmdCalls: { cmd: string; args: string[] }[] = [];

    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async (cmd, args) => {
      cmdCalls.push({ cmd, args });
      if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/1\n", stderr: "" };
      return { stdout: "gh version 2.0\n", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const store = {
      ...makeStore(tmp),
      getIssue: () => ({ title: "Test Feature", description: "A test feature" }),
      getSourceIssues: () => [],
    };
    const deps = {
      store,
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Squash should have been called
    expect(gitCalls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    // Push should have been called with force
    expect(gitCalls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
    // PR should have been created
    expect(cmdCalls.some(c => c.args[0] === "pr" && c.args[1] === "create")).toBe(true);
    // Action should be consumed
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Success notification
    expect(notifications.some(n => n.msg.includes("PR created"))).toBe(true);
  });

  it("AC19: does not consume action when squash fails", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "reset") throw new Error("reset failed");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getIssue: () => null, getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should NOT be consumed (retry possible)
    expect(readState(tmp).doneActions).toContain("push-and-pr");
    // Error should be notified
    expect(notifications.some(n => n.type === "error" && n.msg.includes("squash"))).toBe(true);
  });

  it("AC20: notifies when PR creation is skipped (no gh)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async () => {
      throw new Error("command not found: gh");
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getIssue: () => ({ title: "Test" }), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should be consumed (push succeeded)
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Notification about PR being skipped
    expect(notifications.some(n => n.msg.includes("skipped"))).toBe(true);
  });

  it("consumes action and notifies error when baseBranch is missing", async () => {
    const execGit: ExecGit = async () => {
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: null,
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
      execGit,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    expect(notifications.some((n) => n.type === "error" && n.msg.includes("baseBranch"))).toBe(true);
  });

  it("notifies error (and consumes action) when PR creation fails after push", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const execCmd: ExecCmd = async (cmd, args) => {
      if (cmd === "gh" && args[0] === "--version") return { stdout: "gh version 2.0\n", stderr: "" };
      if (cmd === "gh" && args[0] === "pr") throw new Error("gh pr create failed");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const store = {
      ...makeStore(tmp),
      getIssue: () => ({ title: "Test Feature", description: "A test feature" }),
      getSourceIssues: () => [],
    };
    const deps = {
      store,
      ui: { renderDashboard: () => {} },
      execGit,
      execCmd,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    expect(notifications.some((n) => n.type === "error" && n.msg.includes("PR creation failed"))).toBe(true);
  });
  it("consumes action and skips VCS when branchName is null", async () => {
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: null,
      doneActions: ["push-and-pr"],
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { ...makeStore(tmp), getSourceIssues: () => [] },
      ui: { renderDashboard: () => {} },
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // Action should be consumed (nothing to push)
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    // Info notification about no branch
    expect(notifications.some(n => n.msg.includes("No branch"))).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks.test.ts`
Expected: FAIL — push-and-pr action is not handled, falls through to content-capture section which doesn't consume it

**Step 3 — Write minimal implementation**

**3a. Add `execCmd` to deps in `extensions/megapowers/commands.ts`:**

Add import:
```typescript
import type { ExecCmd } from "./vcs/pr-creator.js";
```

Update types:
```typescript
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };
```

In `ensureDeps`, add after the `execGit` initialization:
```typescript
  if (!rd.execCmd) {
    rd.execCmd = async (cmd: string, args: string[]) => {
      const r = await pi.exec(cmd, args);
      if (r.code !== 0) throw new Error(`${cmd} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    };
  }
  return { pi, store: rd.store, ui: rd.ui, execGit: rd.execGit, execCmd: rd.execCmd };
```

**3b. Handle push-and-pr in `extensions/megapowers/hooks.ts`:**

Add imports:
```typescript
import { squashAndPush } from "./vcs/branch-manager.js";
import { createPR } from "./vcs/pr-creator.js";
```

In `onAgentEnd`, inside the `if (phase === "done" && state.doneActions.length > 0)` block, add a new immediate action handler BEFORE the `close-issue` check:

```typescript
    if (doneAction === "push-and-pr") {
      // AC18: Push & create PR
      if (!deps.execGit || !state.branchName) {
        // No VCS available or no branch tracked — skip and consume
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: No branch tracked — skipping push & PR.", "info");
        return;
      }

      if (!state.baseBranch) {
        // base branch unknown — can't safely squash. Degrade gracefully by consuming the action.
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: baseBranch is missing — skipping push & PR.", "error");
        return;
      }

      const baseBranch = state.baseBranch;
      const issue = store.getIssue(state.activeIssue);
      const commitPrefix = state.workflow === "bugfix" ? "fix" : "feat";
      const commitMsg = `${commitPrefix}: ${issue?.title ?? state.activeIssue}`;

      const pushResult = await squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg);
      if (!pushResult.ok) {
        // AC19: don't consume action on failure — user can retry
        if (ctx.hasUI) ctx.ui.notify(`Push failed (${pushResult.step}): ${pushResult.error}`, "error");
        return;
      }

      // Push succeeded — attempt PR creation
      if (deps.execCmd) {
        const prTitle = issue?.title ?? state.activeIssue;
        const prBody = `Resolves ${state.activeIssue}\n\n${issue?.description ?? ""}`.trim();
        const prResult = await createPR(deps.execCmd, state.branchName, prTitle, prBody);

        if ("skipped" in prResult) {
          // AC20: pushed but no PR
          if (ctx.hasUI) ctx.ui.notify(`Branch pushed. PR creation skipped: ${prResult.reason}`, "info");
        } else if (prResult.ok) {
          if (ctx.hasUI) ctx.ui.notify(`PR created: ${prResult.url}`, "info");
        } else {
          if (ctx.hasUI) ctx.ui.notify(`PR creation failed: ${prResult.error}`, "error");
        }
      } else {
        if (ctx.hasUI) ctx.ui.notify("Branch pushed. PR creation skipped (no execCmd).", "info");
      }

      // Consume action once push succeeds (even if PR creation fails) to avoid repeated force-push retries
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      return;
    }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
