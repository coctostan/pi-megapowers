import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

// Minimal changelog entry that the LLM produces per prompt instructions:
// "Return only the entry block"
const CHANGELOG_ENTRY_SHORT =
`## [Unreleased]
### Fixed
- Fix done-phase deadlock (#090)`;
// ^ length: 54 chars — UNDER the 100-char guard

// capture-learnings: LLM writes file via write(), then says "done"
const CAPTURE_LEARNINGS_RESPONSE = "I've written the learnings to the file.";
// ^ length: 40 chars — UNDER the 100-char guard

function makeStore() {
  let featureDocContent = "";
  let changelogContent = "";
  return {
    writeFeatureDoc: (_slug: string, text: string) => { featureDocContent = text; },
    appendChangelog: (text: string) => { changelogContent += text; },
    _getFeatureDoc: () => featureDocContent,
    _getChangelog: () => changelogContent,
  };
}

function makeCtx(cwd: string) {
  return { hasUI: false, cwd, ui: { notify: () => {} } };
}

function makeDeps(cwd: string) {
  return { store: makeStore(), ui: { renderDashboard: () => {} } };
}

function makeAgentEndEvent(text: string) {
  return {
    messages: [{ role: "assistant", content: [{ type: "text", text }] }],
  };
}

function setState(cwd: string, overrides: any) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "090-done-phase-bug",
    workflow: "bugfix",
    ...overrides,
  });
}

describe("BUG #090: content-capture doneActions never consumed with short LLM response", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bug090-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("BUG: capture-learnings stays stuck forever when LLM writes file directly and produces short response", async () => {
    // Scenario: The done.md prompt for capture-learnings says:
    //   write({ path: ".megapowers/plans/.../learnings.md", content: "..." })
    //   The LLM calls write() and produces a short "done" response.
    // Bug: text.length < 100 → action is never consumed → permanent deadlock.
    setState(tmp, {
      phase: "done",
      doneActions: ["capture-learnings"],
      doneChecklistShown: true,
    });

    await onAgentEnd(
      makeAgentEndEvent(CAPTURE_LEARNINGS_RESPONSE),
      makeCtx(tmp),
      makeDeps(tmp) as any,
    );

    const state = readState(tmp);
    // EXPECTED: capture-learnings should be consumed (LLM wrote the file)
    // ACTUAL: it's still in doneActions because text.length < 100
    expect(state.doneActions).toEqual([]); // FAILS: still contains "capture-learnings"
  });

  it("BUG: write-changelog stays stuck when LLM produces short changelog entry (< 100 chars)", async () => {
    // Scenario: The done.md prompt for write-changelog says:
    //   "Return only the entry block; the system appends it automatically."
    //   A minimal valid changelog entry is ~50 chars.
    // Bug: text.length < 100 → action never consumed → deadlock.
    setState(tmp, {
      phase: "done",
      doneActions: ["write-changelog"],
      doneChecklistShown: true,
    });

    const deps = makeDeps(tmp);
    await onAgentEnd(
      makeAgentEndEvent(CHANGELOG_ENTRY_SHORT),
      makeCtx(tmp),
      deps as any,
    );

    const state = readState(tmp);
    // EXPECTED: write-changelog should be consumed AND the changelog should be appended
    // ACTUAL: it's still in doneActions, and no changelog was appended
    expect(state.doneActions).toEqual([]); // FAILS
    expect((deps.store as any)._getChangelog()).toContain("Unreleased"); // FAILS: nothing appended
  });

  it("BUG: end-to-end — capture-learnings blocks close-issue permanently in real scenario", async () => {
    // Simulate the real-world failure mode:
    // 1. doneActions starts with ["capture-learnings", "close-issue"]
    // 2. LLM writes learnings file, produces short response
    // 3. capture-learnings is never consumed → close-issue never runs → state never resets
    setState(tmp, {
      phase: "done",
      doneActions: ["capture-learnings", "close-issue"],
      doneChecklistShown: true,
    });

    const statusUpdates: { slug: string; status: string }[] = [];
    const deps = {
      store: {
        ...makeStore(),
        getSourceIssues: () => [],
        updateIssueStatus: (slug: string, status: string) =>
          statusUpdates.push({ slug, status }),
      },
      ui: { renderDashboard: () => {} },
    };

    // LLM writes file + produces short response (× 5 retries)
    for (let i = 0; i < 5; i++) {
      await onAgentEnd(
        makeAgentEndEvent(CAPTURE_LEARNINGS_RESPONSE),
        makeCtx(tmp),
        deps as any,
      );
    }

    const state = readState(tmp);
    // EXPECTED: after learnings written, state should reset (close-issue ran)
    // ACTUAL: capture-learnings is permanently stuck, close-issue never runs
    expect(state.activeIssue).toBeNull(); // FAILS: still "090-done-phase-bug"
    expect(statusUpdates.some(u => u.status === "done")).toBe(true); // FAILS
  });
});
