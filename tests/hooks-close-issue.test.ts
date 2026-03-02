/**
 * Failing tests for issue 087: close-issue done action doesn't clear activeIssue/phase
 *
 * These tests FAIL now and should PASS when the bug is fixed.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function makeStore(overrides?: { getSourceIssues?: (slug: string) => any[] }) {
  return {
    writeFeatureDoc: (_slug: string, _text: string) => {},
    appendChangelog: (_text: string) => {},
    getSourceIssues: (_slug: string): any[] => [],
    updateIssueStatus: (_slug: string, _status: string) => {},
    ...overrides,
  };
}

function makeCtx(cwd: string, hasUI = false) {
  return {
    hasUI,
    cwd,
    ui: { notify: () => {} },
  };
}

function makeDeps(cwd: string, storeOverrides?: { getSourceIssues?: (slug: string) => any[] }) {
  return {
    store: makeStore(storeOverrides),
    ui: { renderDashboard: () => {} },
    jj: null,
  };
}

function makeAgentEndEvent(text: string = "") {
  return {
    messages: text
      ? [{ role: "assistant", content: [{ type: "text", text }] }]
      : [],
  };
}

function setState(cwd: string, overrides: any) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test-issue",
    workflow: "feature",
    phase: "done",
    ...overrides,
  });
}

describe("onAgentEnd — close-issue clears activeIssue and phase (issue 087)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-close-issue-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("clears activeIssue to null after close-issue fires", async () => {
    // Bug: writeState({ ...state, doneActions: [] }) spreads activeIssue — never cleared
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);

    const state = readState(tmp);
    expect(state.activeIssue).toBeNull(); // FAILS: still "001-test-issue"
  });

  it("clears phase to null after close-issue fires", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);

    const state = readState(tmp);
    expect(state.phase).toBeNull(); // FAILS: still "done"
  });

  it("removes close-issue from doneActions after it fires", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);

    const state = readState(tmp);
    expect(state.doneActions).toEqual([]);
  });

  it("calls updateIssueStatus to mark issue done", async () => {
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    let updatedSlug: string | null = null;
    let updatedStatus: string | null = null;

    const deps = {
      store: makeStore({
        getSourceIssues: () => [],
      }),
      ui: { renderDashboard: () => {} },
      jj: null,
    };
    // Patch updateIssueStatus
    (deps.store as any).updateIssueStatus = (slug: string, status: string) => {
      updatedSlug = slug;
      updatedStatus = status;
    };

    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), deps as any);

    expect(updatedSlug).toBe("001-test-issue");
    expect(updatedStatus).toBe("done");
  });

  it("new session after close-issue shows no active issue", async () => {
    // Simulates the observed bug: starting a new session after close-issue
    // still shows the old issue as active because activeIssue was never cleared
    setState(tmp, {
      phase: "done",
      doneActions: ["close-issue"],
    });

    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);

    // Simulate reading state on next session start
    const stateOnNextSession = readState(tmp);
    expect(stateOnNextSession.activeIssue).toBeNull();  // FAILS: still "001-test-issue"
    expect(stateOnNextSession.phase).toBeNull();         // FAILS: still "done"
    expect(stateOnNextSession.doneActions).toEqual([]);
  });

  it("secondary bug: unrecognized done actions (e.g. capture-learnings) are consumed even with short LLM text", async () => {
    // Bug: actions only removed when text.length > 100. Short responses leave them stuck,
    // blocking close-issue from ever being reached in the queue.
    setState(tmp, {
      phase: "done",
      doneActions: ["capture-learnings", "close-issue"],
    });

    // Short response (< 100 chars) — capture-learnings should STILL be consumed
    await onAgentEnd(makeAgentEndEvent("short"), makeCtx(tmp), makeDeps(tmp) as any);

    const state = readState(tmp);
    // capture-learnings should be consumed even with short text, so close-issue becomes next
    expect(state.doneActions).not.toContain("capture-learnings"); // FAILS in current code
  });
});
