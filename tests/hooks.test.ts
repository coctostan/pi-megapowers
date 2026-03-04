import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

// --- helpers ---

function makeStore(cwd: string) {
  const docsDir = join(cwd, ".megapowers", "docs");
  const changelogPath = join(cwd, ".megapowers", "CHANGELOG.md");
  let featureDocContent = "";
  let changelogContent = "";
  return {
    writeFeatureDoc: (_slug: string, text: string) => { featureDocContent = text; },
    appendChangelog: (text: string) => { changelogContent += text; },
    _getFeatureDoc: () => featureDocContent,
    _getChangelog: () => changelogContent,
  };
}

function makeCtx(cwd: string, hasUI = false) {
  return {
    hasUI,
    cwd,
    ui: {
      notify: () => {},
    },
  };
}

function makeDeps(cwd: string) {
  return {
    store: makeStore(cwd),
    ui: { renderDashboard: () => {} },
  };
}

function makeAgentEndEvent(text: string) {
  return {
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function setState(cwd: string, overrides: any) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  });
}

describe("onAgentEnd — done-phase doneActions cleanup", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("removes capture-learnings from doneActions after agent produces long text", async () => {
    // Bug: capture-learnings is special-cased and never removed from doneActions.
    // Fix: remove the special case so it is removed like other actions.
    setState(tmp, {
      phase: "done",
      doneActions: ["capture-learnings"],
    });

    const longText = "A".repeat(150); // > 100 chars threshold
    await onAgentEnd(makeAgentEndEvent(longText), makeCtx(tmp), makeDeps(tmp) as any);

    const state = readState(tmp);
    expect(state.doneActions).toEqual([]); // should be removed
  });

  it("removes generate-docs from doneActions after agent produces long text", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["generate-docs", "write-changelog"],
    });

    const longText = "A".repeat(150);
    await onAgentEnd(makeAgentEndEvent(longText), makeCtx(tmp), makeDeps(tmp) as any);

    // first action "generate-docs" should be removed; "write-changelog" remains for next turn
    const state = readState(tmp);
    expect(state.doneActions).not.toContain("generate-docs");
  });

  it("populates doneActions (and sets doneChecklistShown) when in done phase with empty doneActions", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, /* hasUI */ false), makeDeps(tmp) as any);

    const state = readState(tmp);
    expect(state.doneActions.length).toBeGreaterThan(0);
    expect(state.doneChecklistShown).toBe(true);
  });

  it("does nothing when not in done phase", async () => {
    setState(tmp, { phase: "verify", doneActions: [] });

    await onAgentEnd(makeAgentEndEvent("A".repeat(150)), makeCtx(tmp), makeDeps(tmp) as any);

    expect(readState(tmp).phase).toBe("verify");
  });

  it("does nothing when text is shorter than 100 chars", async () => {
    setState(tmp, { phase: "done", doneActions: ["capture-learnings"] });

    await onAgentEnd(makeAgentEndEvent("short response"), makeCtx(tmp), makeDeps(tmp) as any);

    // Short text means the capture block is not entered — list unchanged
    expect(readState(tmp).doneActions).toEqual(["capture-learnings"]);
  });
});

describe("handlePhaseBack — no intermediate state write", () => {
  it("tool-signal.ts does not contain a redundant intermediate writeState in handlePhaseBack", () => {
    // handlePhaseBack previously double-read state and wrote reviewApproved: false
    // before calling advancePhase. transition() already handles this. The explicit
    // intermediate write should not be present.
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"),
      "utf-8",
    );

    // Find the handlePhaseBack function body
    const start = source.indexOf("function handlePhaseBack");
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);

    // Should not contain a writeState call BEFORE advancePhase inside handlePhaseBack
    // The pattern to avoid: writeState(cwd, { ...currentState, reviewApproved: false })
    // transition() in state-machine.ts handles this invariant.
    const writeBeforeAdvance = /writeState[\s\S]*?reviewApproved:\s*false[\s\S]*?advancePhase/;
    expect(writeBeforeAdvance.test(body)).toBe(false);
  });
});


it("hooks.ts no longer imports jj availability helpers/messages", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf-8");
  expect(source).not.toContain("checkJJAvailability");
  expect(source).not.toContain("JJ_INSTALL_MESSAGE");
  expect(source).not.toContain("JJ_INIT_MESSAGE");
});

import type { ExecGit } from "../extensions/megapowers/vcs/git-ops.js";
import type { ExecCmd } from "../extensions/megapowers/vcs/pr-creator.js";

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

    expect(gitCalls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
    expect(gitCalls.some(c => c[0] === "push" && c.includes("--force-with-lease"))).toBe(true);
    expect(cmdCalls.some(c => c.args[0] === "pr" && c.args[1] === "create")).toBe(true);
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
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

    expect(readState(tmp).doneActions).toContain("push-and-pr");
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

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
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

    expect(readState(tmp).doneActions).not.toContain("push-and-pr");
    expect(notifications.some(n => n.msg.includes("No branch"))).toBe(true);
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
});


describe("onAgentEnd — deferred done checklist (#083)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-done-checklist-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function setupIssue(cwd: string) {
    const issuesDir = join(cwd, ".megapowers", "issues");
    mkdirSync(issuesDir, { recursive: true });
    writeFileSync(
      join(issuesDir, "001-test.md"),
      "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2025-01-01T00:00:00Z\n---\n# Test Issue\nDescription",
    );
  }

  it("calls showDoneChecklist when phase=done, doneActions=[], hasUI=true, doneChecklistShown=false", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    let checklistCalled = false;
    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        notify: () => {},
        custom: async (_fn: any) => {
          checklistCalled = true;
          return ["generate-docs", "close-issue"];
        },
      },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("review complete"), ctx as any, deps as any);

    expect(checklistCalled).toBe(true);
    const state = readState(tmp);
    expect(state.doneChecklistShown).toBe(true);
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneActions).toContain("close-issue");
  });

  it("does NOT call showDoneChecklist when doneChecklistShown=true", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: true });

    let checklistCalled = false;
    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        notify: () => {},
        custom: async (_fn: any) => {
          checklistCalled = true;
          return ["close-issue"];
        },
      },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

    expect(checklistCalled).toBe(false);
  });

  it("auto-populates defaults in headless mode (hasUI=false) via showDoneChecklist", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    const ctx = {
      hasUI: false,
      cwd: tmp,
      ui: { notify: () => {} },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

    const state = readState(tmp);
    expect(state.doneActions).toContain("close-issue");
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneChecklistShown).toBe(true);
  });

  it("end-to-end headless: deferred defaults eventually reach close-issue and reset state (#081 regression)", async () => {
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    const statusUpdates: { slug: string; status: string }[] = [];
    const ctx = makeCtx(tmp, /* hasUI */ false);
    const deps = {
      store: {
        ...makeStore(tmp),
        getSourceIssues: () => [],
        updateIssueStatus: (slug: string, status: string) => statusUpdates.push({ slug, status }),
      },
      ui: { renderDashboard: () => {} },
    };

    // 1) Populate defaults (deferred checklist fires, doneActions filled, doneChecklistShown = true)
    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

    // 2-4) Consume content-capture actions
    const longText = "A".repeat(150);
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // generate-docs
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // write-changelog
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // capture-learnings

    // 5) Consume push-and-pr (immediate; no execGit/branch -> skipped+consumed)
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);

    // 6) close-issue executes and state resets
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);

    expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
    const finalState = readState(tmp);
    expect(finalState.activeIssue).toBeNull();
    expect(finalState.phase).toBeNull();
  });
});


describe("BUG #087: push-and-pr permanently blocks when on main after PR merge", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-bug087-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("push-and-pr stays stuck permanently when local feature branch is deleted (on main after merge)", async () => {
    // Simulate: user is on main after merging PR; local feature branch was deleted.
    // git reset --soft main  → no-op (already at main, clean tree)
    // git status --porcelain → empty (nothing staged)
    // git push origin feat/001-test --force-with-lease → FAILS (local branch doesn't exist)
    const execGit: ExecGit = async (args) => {
      if (args[0] === "rev-parse" && args[1] === "--verify")
        throw new Error("fatal: Needed a single revision");
      if (args[0] === "reset") return { stdout: "", stderr: "" }; // no-op on main
      if (args[0] === "status") return { stdout: "", stderr: "" }; // clean tree
      if (args[0] === "push") throw new Error("error: src refspec feat/001-test does not match any");
      return { stdout: "", stderr: "" };
    };

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      branchName: "feat/001-test",
      baseBranch: "main",
      doneActions: ["push-and-pr", "close-issue"],
      doneChecklistShown: true,
    });

    const notifications: { msg: string; type: string }[] = [];
    const statusUpdates: { slug: string; status: string }[] = [];
    const deps = {
      store: {
        ...makeStore(tmp),
        getIssue: () => ({ title: "Test Feature", description: "" }),
        getSourceIssues: () => [],
        updateIssueStatus: (slug: string, status: string) => statusUpdates.push({ slug, status }),
      },
      ui: { renderDashboard: () => {} },
      execGit,
    } as any;
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: { notify: (msg: string, type: string) => notifications.push({ msg, type }) },
    };

    // Simulate 3 successive onAgentEnd calls (multiple sessions / retries)
    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);
    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);
    await onAgentEnd(makeAgentEndEvent("short"), ctx, deps);

    // BUG: push-and-pr is never consumed — permanently stuck
    // Expected fix: handler should detect "already on base branch / branch gone" and skip/consume
    expect(readState(tmp).doneActions).not.toContain("push-and-pr");

    // BUG: close-issue never runs because push-and-pr permanently blocks it
    expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
    expect(readState(tmp).activeIssue).toBeNull();
  });

  it("squashOnto is a no-op when already on main (precondition that causes the push to fail)", async () => {
    // This demonstrates WHY the push fails: squashOnto returns ok: true committed: false
    // when on main with a clean working tree, so execution reaches pushBranch with a
    // non-existent local branch name.
    const { squashOnto } = await import("../extensions/megapowers/vcs/git-ops.js");

    const gitCalls: string[][] = [];
    const execGit: ExecGit = async (args) => {
      gitCalls.push(args);
      if (args[0] === "reset") return { stdout: "", stderr: "" }; // no-op
      if (args[0] === "status") return { stdout: "", stderr: "" }; // clean
      throw new Error("unexpected git call: " + args.join(" "));
    };

    const result = await squashOnto(execGit, "main", "feat: done");

    // squashOnto returns ok: true, committed: false (no error from squash)
    // This means execution continues to pushBranch — which then fails on the missing local branch
    expect(result).toEqual({ ok: true, committed: false });
    expect(gitCalls.some(c => c[0] === "reset" && c[1] === "--soft" && c[2] === "main")).toBe(true);
  });
});
