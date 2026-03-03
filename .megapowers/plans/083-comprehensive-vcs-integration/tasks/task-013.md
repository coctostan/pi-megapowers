---
id: 13
title: switchAwayCommit on issue switch
status: approved
depends_on:
  - 7
  - 12
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - tests/vcs-commands.test.ts
files_to_create: []
---

### Task 13: switchAwayCommit on issue switch [depends: 7, 12]

**Architecture note (same as Task 12):** The switchAwayCommit call is wired in `commands.ts` (not `ui.ts`)
for the same reasons stated in Task 12: `commands.ts` holds `deps.execGit`, can compare prev/new state,
and is the correct orchestration layer for post-activation side-effects. The AC15 switch logic is added
before the `ensureBranch` call from Task 12, so the WIP commit on the old branch happens before the new
branch is checked out.

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/vcs-commands.test.ts`

**Step 1 — Write the failing test**

Add to `tests/vcs-commands.test.ts`:

```typescript
import { switchAwayCommit } from "../extensions/megapowers/vcs/branch-manager.js";

describe("handleIssueCommand — VCS switchAwayCommit on issue switch (AC15)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vcs-switch-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("calls switchAwayCommit with previous branchName before activating new issue", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "feat/001-old-issue\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    // Pre-populate state with an active issue and branch
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: "feat/001-old-issue",
    });

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should have WIP committed on old branch
    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/001-old-issue")).toBe(true);
    // Should have created new branch
    const state = readState(tmp);
    expect(state.branchName).toBe("feat/002-new-issue");
  });

  it("skips switchAwayCommit when previous state has no branchName", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    // Pre-populate state with active issue but no branch
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: null,
    });

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    // Should NOT have called WIP commit (no old branch)
    expect(calls.some(c => c[0] === "commit")).toBe(false);
    // Should still create new branch
    expect(readState(tmp).branchName).toBe("feat/002-new-issue");
  });

  it("surfaces switchAwayCommit error via notify without blocking (AC16)", async () => {
    const execGit: ExecGit = async (args) => {
      if (args[0] === "add") throw new Error("index lock failed");
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: "feat/001-old-issue",
    });

    const notifications: { msg: string; type: string }[] = [];
    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    await handleIssueCommand("list", ctx, deps);

    // switchAwayCommit error notified
    expect(notifications.some(n => n.type === "error")).toBe(true);
    // New issue still activated (not blocked)
    expect(readState(tmp).activeIssue).toBe("002-new-issue");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/vcs-commands.test.ts`
Expected: FAIL — WIP commit call not found in calls (switchAwayCommit not called yet)

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/commands.ts`:

Add import:
```typescript
import { ensureBranch, switchAwayCommit } from "./vcs/branch-manager.js";
```
(Update the existing `ensureBranch` import to also include `switchAwayCommit`.)

Update the import (added in Task 12) to also include `switchAwayCommit`:
```typescript
import { ensureBranch, switchAwayCommit } from "./vcs/branch-manager.js";
```

Update `handleIssueCommand` to add switchAwayCommit BEFORE the baseBranch capture and ensureBranch
call (which were added in Task 12). The complete function body becomes:
```typescript
export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const prevState = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, prevState, deps.store, args);

  // VCS: branch management on issue activation / switch
  if (deps.execGit && newState.activeIssue && newState.activeIssue !== prevState.activeIssue && newState.workflow) {
    // AC15: WIP commit on previous issue's branch before switching away
    if (prevState.branchName) {
      const switchResult = await switchAwayCommit(deps.execGit, prevState.branchName);
      if (!switchResult.ok) {
        // AC16: surface error, don't block
        if (ctx.hasUI) ctx.ui.notify(`VCS: ${switchResult.error}`, "error");
      }
    }

    // Capture current HEAD before ensureBranch switches branches (for baseBranch persistence)
    let baseBranch: string | null = null;
    try {
      const r = await deps.execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
      baseBranch = r.stdout.trim() || null;
    } catch { /* ignore */ }

    // AC14: ensure branch for new issue
    const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
    if ("branchName" in result) {
      newState.branchName = result.branchName;
      newState.baseBranch = baseBranch;
    } else {
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
