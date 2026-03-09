import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-open-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Open/Activate action", () => {
  it("activates the selected issue with the same state reset used by the old `/issue list` flow", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Target issue", "bugfix", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: "999-old-issue",
      workflow: "feature" as const,
      phase: "plan" as const,
      completedTasks: [1, 2],
      currentTaskIndex: 2,
      tddTaskState: { taskIndex: 2, state: "impl-allowed" as const, skipped: false },
    };

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "open", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe(target.slug);
    expect(nextState.workflow).toBe("bugfix");
    expect(nextState.phase).toBe("reproduce");
    expect(nextState.completedTasks).toEqual([]);
    expect(nextState.currentTaskIndex).toBe(0);
    expect(nextState.tddTaskState).toBeNull();
    expect(store.getIssue(target.slug)?.status).toBe("in-progress");
  });
});
