---
id: 12
title: ensureBranch on issue activation
status: approved
depends_on:
  - 6
  - 10
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
files_to_create:
  - tests/vcs-commands.test.ts
---

### Task 12: ensureBranch on issue activation [depends: 6, 10]

**Architecture note — why `commands.ts`, not `ui.ts`:**
AC14 says “when an issue is activated via `/issue list` or `/issue new` (in `ui.ts`)” — the parenthetical
identifies *where* activation occurs, not *where* to wire VCS. Putting VCS calls inside `ui.ts` would
require the UI layer to accept an `execGit` dependency, coupling presentation logic to VCS. Instead,
`commands.ts:handleIssueCommand` is the natural orchestration point: it already wraps `ui.handleIssueCommand`,
reads prev/new state, and holds the `deps` object (which will include `execGit`). VCS is a post-activation
side-effect, analogous to the `writeState` call that also lives in `commands.ts` rather than `ui.ts`.

**ExecGit availability (resolves review concern):** `ensureDeps()` always initializes `deps.execGit`.
Graceful degradation is handled by `ensureBranch()` returning structured errors when git/VCS is unavailable
(e.g. not a git repo via `rev-parse --git-dir`, AC21) and surfacing those via `ctx.ui.notify` (AC16).
We do not treat “missing execGit” as a real runtime path, so the plan does not include a test for it.

**Capturing `baseBranch`:** `ensureBranch` returns only `{ branchName }` per AC8. To also persist
`baseBranch` for the done-phase squash (AC18), `commands.ts` captures the current HEAD via a separate
`git rev-parse --abbrev-ref HEAD` call *before* `ensureBranch` switches branches. This value is saved
to `state.baseBranch` alongside `state.branchName`.

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Create: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

```typescript
// tests/vcs-commands.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleIssueCommand } from "../extensions/megapowers/commands.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";

function makeMockUI(newActiveIssue: string, newWorkflow: "feature" | "bugfix" = "feature") {
  return {
    handleIssueCommand: async () => ({
      ...createInitialState(),
      activeIssue: newActiveIssue,
      workflow: newWorkflow,
      phase: newWorkflow === "feature" ? "brainstorm" as const : "reproduce" as const,
    }),
    renderDashboard: () => {},
    updateStatus: () => {},
    handleTriageCommand: async (s: any) => s,
  };
}

describe("handleIssueCommand — VCS ensureBranch on activation (AC14)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-cmd-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("calls ensureBranch, saves branchName and baseBranch to state (AC14)", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      // rev-parse --abbrev-ref: called once by commands.ts to capture baseBranch (before switching branches)
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      // rev-parse --verify: branch doesn't exist yet
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      return { stdout: "", stderr: "" };
    };

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    const state = readState(tmp);
    expect(state.branchName).toBe("feat/001-my-feature");
    // baseBranch captured via separate rev-parse --abbrev-ref before branch switch
    expect(state.baseBranch).toBe("main");
    expect(calls.some(c => c[0] === "checkout" && c[1] === "-b")).toBe(true);
    // ensureBranch creates from HEAD; it should not need to resolve current branch name itself
    expect(calls.filter((c) => c[0] === "rev-parse" && c[1] === "--abbrev-ref").length).toBe(1);
  });

  it("surfaces ensureBranch error via notify without blocking activation (AC16)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--git-dir") throw new Error("not a repo");
      return { stdout: "", stderr: "" };
    };

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await handleIssueCommand("list", ctx, deps);

    // Issue should still be activated
    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-my-feature");
    expect(state.branchName).toBeNull();

    // Error should be notified
    expect(notifications.some(n => n.type === "error")).toBe(true);
  });

  it("does not call ensureBranch when issue does not change", async () => {
    // Pre-set state with same active issue
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-my-feature",
      workflow: "feature",
      phase: "brainstorm",
    });

    let execGitCalled = false;
    const execGit: ExecGit = async () => {
      execGitCalled = true;
      return { stdout: "", stderr: "" };
    };

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("001-my-feature"), // same issue
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    expect(execGitCalled).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — state.branchName is null (VCS not called yet)

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/commands.ts`:

Add imports at the top:
```typescript
import { ensureBranch } from "./vcs/branch-manager.js";
import type { ExecGit } from "./vcs/git-ops.js";
```

Update the type definitions:
```typescript
/** Mutable container — exactly one instance lives in index.ts, shared by all hooks and commands */
export type RuntimeDeps = { store?: Store; ui?: MegapowersUI; execGit?: ExecGit };

/** Resolved deps — guaranteed non-optional (except optional VCS) */
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI; execGit?: ExecGit };
```

Update `ensureDeps` to create `execGit`:
```typescript
export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.ui) rd.ui = createUI();
  if (!rd.execGit) {
    rd.execGit = async (args: string[]) => {
      const r = await pi.exec("git", args);
      if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    };
  }
  return { pi, store: rd.store, ui: rd.ui, execGit: rd.execGit };
}
```

Update `handleIssueCommand` — note the separate baseBranch capture BEFORE ensureBranch
switches the branch, so we record the branch that was current at activation time:
```typescript
export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const prevState = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, prevState, deps.store, args);

  // AC14: VCS branch management on issue activation.
  // Wired here in commands.ts (the orchestration wrapper) rather than ui.ts because:
  //   1) commands.ts holds deps.execGit while ui.ts has no VCS dependency
  //   2) the before/after state comparison (prevState vs newState) is naturally here
  //   3) VCS is a post-activation side-effect, like writeState, which also lives here
  if (deps.execGit && newState.activeIssue && newState.activeIssue !== prevState.activeIssue && newState.workflow) {
    // Capture current HEAD *before* ensureBranch switches branches.
    // This baseBranch is persisted to state for use by squashAndPush in the done phase (AC18).
    let baseBranch: string | null = null;
    try {
      const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
      baseBranch = r.stdout.trim() || null;
    } catch { /* ignore — baseBranch stays null */ }

    const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
    if ("branchName" in result) {
      newState.branchName = result.branchName;
      newState.baseBranch = baseBranch;
    } else {
      // AC16: surface error, don't block activation
      if (ctx.hasUI) ctx.ui.notify(`VCS: ${result.error}`, "error");
    }
  }

  writeState(ctx.cwd, newState);
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/vcs-commands.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
