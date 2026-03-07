import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleIssueCommand, maybeSwitchAwayFromIssue } from "../extensions/megapowers/commands.js";
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
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "main\n", stderr: "" };
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
    expect(state.baseBranch).toBe("main");
    expect(calls.some(c => c[0] === "checkout" && c[1] === "-b")).toBe(true);
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

    const state = readState(tmp);
    expect(state.activeIssue).toBe("001-my-feature");
    expect(state.branchName).toBeNull();
    expect(notifications.some(n => n.type === "error")).toBe(true);
  });

  it("does not call ensureBranch when issue does not change", async () => {
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
      ui: makeMockUI("001-my-feature"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    expect(execGitCalled).toBe(false);
  });
});

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

    expect(calls.some(c => c[0] === "commit" && c[2] === "WIP: feat/001-old-issue")).toBe(true);
    const state = readState(tmp);
    expect(state.branchName).toBe("feat/002-new-issue");
  });

  it("returns committed: false and does not commit when switching away from a clean branch", async () => {
    const calls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      calls.push(args);
      if (args[0] === "add") return { stdout: "", stderr: "" };
      if (args[0] === "status") return { stdout: "", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    await expect(maybeSwitchAwayFromIssue(execGit, "feat/001-old-issue")).resolves.toEqual({
      ok: true,
      committed: false,
    });
    expect(calls.some((c) => c[0] === "commit")).toBe(false);
  });

  it("propagates prevState.baseBranch (not current HEAD) as baseBranch on issue switch", async () => {
    // When switching from feat/001 to feat/002, the baseBranch should come from
    // prevState.baseBranch (e.g. "main"), NOT from the current HEAD (feat/001-old-issue).
    // Otherwise squashOnto would squash onto the old feature branch, not main.
    const execGit: ExecGit = async (args) => {
      if (args[0] === "status") return { stdout: "M file.ts\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--verify") throw new Error("not found");
      // Current HEAD is the OLD feature branch — should NOT be used as baseBranch
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "feat/001-old-issue\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-old-issue",
      workflow: "feature",
      phase: "implement",
      branchName: "feat/001-old-issue",
      baseBranch: "main", // the true origin base
    });

    const deps = {
      store: { listIssues: () => [] } as any,
      ui: makeMockUI("002-new-issue"),
      execGit,
    } as any;

    const ctx = { cwd: tmp, hasUI: false, ui: { notify: () => {} } };
    await handleIssueCommand("list", ctx, deps);

    const state = readState(tmp);
    // baseBranch should be propagated from prev state ("main"), not captured from HEAD
    expect(state.baseBranch).toBe("main");
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

    expect(calls.some(c => c[0] === "commit")).toBe(false);
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

    expect(notifications.some(n => n.type === "error")).toBe(true);
    expect(readState(tmp).activeIssue).toBe("002-new-issue");
  });
});

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