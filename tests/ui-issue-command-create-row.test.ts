import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-create-row-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("create row action", () => {
  it("enters the existing issue creation flow when the widget returns a create action", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();
    store.createIssue("Existing issue", "feature", "desc", undefined, "M1", 1);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "create" }),
        select: async (prompt: string) => (prompt.includes("Issue type") ? "feature" : null),
        input: async () => "Created from widget",
        editor: async () => "Widget-created description",
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe("002-created-from-widget");
    expect(nextState.workflow).toBe("feature");
    expect(store.getIssue("002-created-from-widget")?.status).toBe("in-progress");
  });
});
