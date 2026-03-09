import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createUI } from "../extensions/megapowers/ui.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-command-list-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function createMockCtx(selectReturn?: string) {
  const notifications: string[] = [];
  const selects: string[][] = [];
  return {
    hasUI: true,
    cwd: tmp,
    ui: {
      theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
      select: async (_prompt: string, items: string[]) => {
        selects.push(items);
        return selectReturn ?? null;
      },
      input: async () => null,
      editor: async () => null,
      notify: (msg: string) => notifications.push(msg),
      setWidget: () => {},
      setStatus: () => {},
    },
    _notifications: notifications,
    _selects: selects,
  };
}

describe("issue command list and archived view (AC7-AC12, AC28, AC30)", () => {
  it("shows grouped active issues in default list and archived issues only in archived view", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();

    store.createIssue("M2 item", "feature", "desc", undefined, "M2", 2);
    const m1 = store.createIssue("M1 top", "feature", "desc", undefined, "M1", 1);

    const archiveDir = join(tmp, ".megapowers", "issues", "archive");
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(
      join(archiveDir, "099-archived-item.md"),
      `---\nid: 99\ntype: feature\nstatus: archived\ncreated: 2026-03-01T00:00:00.000Z\nmilestone: M1\npriority: 1\narchived: 2026-03-02T00:00:00.000Z\n---\n# Archived item\narchived desc\n`,
    );

    const listCtx = createMockCtx(`#${String(m1.id).padStart(3, "0")} [P1] M1 top [open]`);
    await ui.handleIssueCommand(listCtx as any, state, store, "list");

    const renderedItems = listCtx._selects[0].join("\n");
    expect(renderedItems).toContain("M1:");
    expect(renderedItems).toContain("M2:");
    expect(renderedItems).toContain("#002 [P1] M1 top [open]");
    expect(renderedItems).not.toContain("Archived item");

    const archivedCtx = createMockCtx();
    await ui.handleIssueCommand(archivedCtx as any, state, store, "archived");
    expect(archivedCtx._notifications.join("\n")).toContain("Archived item");
    expect(archivedCtx._notifications.join("\n")).not.toContain("M1 top");
  });
});
