import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-close-actions-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("close actions", () => {
  it("closes a non-active issue and keeps the active issue unchanged", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const nonActive = store.createIssue("Non active close", "feature", "desc", undefined, "M1", 1);
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 2);
    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close", issue: nonActive }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterClose = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(nonActive.slug)?.status).toBe("done");
    expect(afterClose.activeIssue).toBe(active.slug);
  });

  it("closes the active issue immediately for close-now", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close-now", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterCloseNow = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(active.slug)?.status).toBe("done");
    expect(afterCloseNow.activeIssue).toBeNull();
  });

  it("sends the active issue to done phase for go-to-done", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "code-review" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "go-to-done", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterDone = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(afterDone.phase).toBe("done");
    expect(readState(tmp).phase).toBe("done");
  });
});
