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


  it("hooks.ts does not contain done-phase action processing or text scraping", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf-8");
    expect(source).not.toContain("squashAndPush");
    expect(source).not.toContain("createPR");
    expect(source).not.toContain("getAssistantText");
    expect(source).not.toContain("isAssistantMessage");
    expect(source).not.toContain('doneAction === "close-issue"');
    expect(source).not.toContain('doneAction === "push-and-pr"');
    expect(source).not.toContain("doneActions[0]");
  });

  it("onAgentEnd in done phase with doneActions does not consume actions (prompt context only)", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["generate-docs", "close-issue"],
      doneChecklistShown: true,
    });
    let dashboardRendered = false;
    const deps = {
      store: makeStore(tmp),
      ui: { renderDashboard: () => { dashboardRendered = true; } },
    } as any;
    await onAgentEnd(makeAgentEndEvent("A".repeat(200)), makeCtx(tmp, true), deps);
    const state = readState(tmp);
    expect(state.doneActions).toEqual(["generate-docs", "close-issue"]);
    expect(dashboardRendered).toBe(true);
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

});


