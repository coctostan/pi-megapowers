import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
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
    jj: null,
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

  it("does nothing when doneActions is empty", async () => {
    setState(tmp, { phase: "done", doneActions: [] });

    await onAgentEnd(makeAgentEndEvent("some text"), makeCtx(tmp), makeDeps(tmp) as any);

    expect(readState(tmp).doneActions).toEqual([]);
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
