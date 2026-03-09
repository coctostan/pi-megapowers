import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-archive-command-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function createMockCtx() {
  const notifications: string[] = [];
  return {
    hasUI: true,
    cwd: tmp,
    ui: {
      theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
      select: async () => null,
      input: async () => null,
      editor: async () => null,
      notify: (msg: string) => notifications.push(msg),
      setWidget: () => {},
      setStatus: () => {},
    },
    _notifications: notifications,
  };
}

describe("issue archive subcommand (AC25-AC27)", () => {
  it("archives non-active issues without resetting state and resets state when archiving the active issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const nonActive = store.createIssue("Non active", "feature", "desc");
    const active = store.createIssue("Active", "feature", "desc");

    const baseState: MegapowersState = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature",
      phase: "spec",
    };

    const ctx = createMockCtx();
    const afterNonActive = await ui.handleIssueCommand(ctx as any, baseState, store, `archive ${nonActive.slug}`);
    expect(afterNonActive.activeIssue).toBe(active.slug);
    expect(store.listIssues().some(i => i.slug === nonActive.slug)).toBe(false);
    expect(store.listArchivedIssues().some(i => i.slug === nonActive.slug)).toBe(true);

    const afterActive = await ui.handleIssueCommand(ctx as any, afterNonActive, store, `archive ${active.slug}`);
    expect(afterActive.activeIssue).toBeNull();
    expect(afterActive.workflow).toBeNull();
    expect(afterActive.phase).toBeNull();
    expect(store.listArchivedIssues().some(i => i.slug === active.slug)).toBe(true);
    expect(ctx._notifications.join("\n")).toContain(`Archived: ${active.slug}`);
  });
});
