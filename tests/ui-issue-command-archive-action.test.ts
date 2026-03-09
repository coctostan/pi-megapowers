import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-archive-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Archive action", () => {
  it("archives the selected issue via the existing store archive path", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Archive me", "feature", "desc", undefined, "M1", 1);
    const state = createInitialState();
    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "archive", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(target.slug)).toBeNull();
    expect(store.listArchivedIssues().some((issue) => issue.slug === target.slug)).toBe(true);
  });

  it("resets active state when the active issue is archived via the widget", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active issue", "feature", "desc", undefined, "M1", 1);
    const { writeState } = await import("../extensions/megapowers/state/state-io.js");
    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "plan" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "archive", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");

    expect(store.getIssue(active.slug)).toBeNull();
    expect(store.listArchivedIssues().some((issue) => issue.slug === active.slug)).toBe(true);
    expect(nextState.activeIssue).toBeNull();
    expect(nextState.phase).toBeNull();
  });
});
