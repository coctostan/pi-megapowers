import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  renderDashboardLines,
  renderStatusText,
  formatPhaseProgress,
  formatIssueListItem,
  createUI,
} from "../extensions/megapowers/ui.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/store.js";

// Stub theme — just returns text unformatted
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

function createMockCtx(selectReturn?: string) {
  const notifications: { msg: string; type: string }[] = [];
  const widgets: Record<string, any> = {};
  const statuses: Record<string, any> = {};

  return {
    hasUI: true,
    ui: {
      theme: plainTheme,
      select: async (_prompt: string, _items: string[]) => selectReturn ?? null,
      input: async (_prompt: string): Promise<string | null> => null,
      editor: async (_prompt: string, _initial?: string): Promise<string | null> => null,
      notify: (msg: string, type: string) => { notifications.push({ msg, type }); },
      setWidget: (id: string, content: any) => { widgets[id] = content; },
      setStatus: (id: string, content: any) => { statuses[id] = content; },
    },
    _notifications: notifications,
    _widgets: widgets,
    _statuses: statuses,
  };
}

function createMockJJ() {
  return {
    isJJRepo: async () => false,
    describe: async () => {},
    newChange: async () => null,
    log: async () => [],
  };
}

describe("renderDashboardLines — no active issue", () => {
  it("shows no-issue message with commands", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("No active issue");
    expect(joined).toContain("/issue new");
    expect(joined).toContain("/issue list");
  });
});

describe("renderDashboardLines — active issue", () => {
  it("shows issue, phase, and task progress", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth-refactor",
      workflow: "feature",
      phase: "plan",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: false },
      ],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("001-auth-refactor");
    expect(joined).toContain("feature");
    expect(joined).toContain("plan");
    expect(joined).toContain("1/2");
  });
});

describe("renderStatusText", () => {
  it("returns empty when no active issue", () => {
    expect(renderStatusText(createInitialState())).toBe("");
  });

  it("returns compact status", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      planTasks: [
        { index: 1, description: "A", completed: true },
        { index: 2, description: "B", completed: false },
        { index: 3, description: "C", completed: false },
      ],
    };
    const text = renderStatusText(state);
    expect(text).toContain("#001");
    expect(text).toContain("implement");
    expect(text).toContain("1/3");
  });
});

describe("formatPhaseProgress", () => {
  it("shows feature phases with current highlighted", () => {
    const result = formatPhaseProgress("feature", "plan", plainTheme as any);
    expect(result).toContain("brainstorm");
    expect(result).toContain("plan");
    expect(result).toContain("implement");
  });
});

describe("formatPhaseProgress — code-review phase", () => {
  it("includes code-review in feature phase progression", () => {
    const result = formatPhaseProgress("feature", "code-review", plainTheme as any);
    expect(result).toContain("code-review");
    expect(result).toContain("▶code-review");
  });

  it("shows code-review as completed when in done phase", () => {
    const result = formatPhaseProgress("feature", "done", plainTheme as any);
    expect(result).toContain("code-review");
  });
});

describe("formatIssueListItem", () => {
  it("formats an issue for selection", () => {
    const result = formatIssueListItem({
      id: 1,
      slug: "001-auth",
      title: "Auth refactor",
      type: "feature",
      status: "open",
      description: "",
      createdAt: 0,
    });
    expect(result).toContain("#001");
    expect(result).toContain("Auth refactor");
    expect(result).toContain("feature");
    expect(result).toContain("open");
  });
});

describe("handlePhaseTransition — gate enforcement", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-gate-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("blocks gated transitions with error notification", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    };

    // Select the gated option (which will include ⛔)
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      // Pick the gated option containing ⛔
      return items.find(i => i.includes("⛔")) ?? items[0];
    };
    const result = await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    // Should NOT transition — gate blocks it
    expect(result.phase).toBe("spec");
    expect(ctx._notifications.some(n => n.type === "error")).toBe(true);
  });

  it("allows transition when gate passes", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
    };

    // brainstorm → spec always passes gate
    const ctx = createMockCtx("spec");
    const result = await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    expect(result.phase).toBe("spec");
  });

  it("labels backward transitions with ← prefix", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "verify",
    };

    // Capture what select is called with
    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null; // cancel
    };

    await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    // verify → implement should be labeled as backward
    expect(selectItems.some(item => item.includes("←") && item.includes("implement"))).toBe(true);
  });

  it("marks gated options with ⛔ in select labels", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "verify",
    };

    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null;
    };

    await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    // verify → code-review should be gated (no verify.md)
    expect(selectItems.some(item => item.includes("⛔") && item.includes("code-review"))).toBe(true);
  });
});

describe("renderDashboardLines — implement phase with tasks", () => {
  it("shows per-task progress count", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "implement",
      planTasks: [
        { index: 1, description: "Set up schema", completed: true },
        { index: 2, description: "Create endpoint", completed: false },
        { index: 3, description: "Write tests", completed: false },
      ],
      currentTaskIndex: 1,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("1/3");
  });

  it("shows current task name in implement phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "implement",
      planTasks: [
        { index: 1, description: "Set up schema", completed: true },
        { index: 2, description: "Create endpoint", completed: false },
        { index: 3, description: "Write tests", completed: false },
      ],
      currentTaskIndex: 1,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("Create endpoint");
  });
});

describe("renderDashboardLines — verify phase with criteria", () => {
  it("shows acceptance criteria pass count", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "verify",
      acceptanceCriteria: [
        { id: 1, text: "User can register", status: "pass" },
        { id: 2, text: "Email validated", status: "pending" },
      ],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("Criteria:");
    expect(joined).toContain("1/2");
  });
});

describe("handleIssueCommand — new state fields", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-issue-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("new issue includes acceptanceCriteria and currentTaskIndex", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state = createInitialState();

    const ctx = createMockCtx();
    ctx.ui.input = async () => "Test issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "new");

    expect(result.activeIssue).toBeTruthy();
    expect(result.acceptanceCriteria).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });

  it("list activation resets stale acceptanceCriteria and currentTaskIndex", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    // Create an existing issue to select from list
    const issue = store.createIssue("Existing feature", "feature", "desc");

    // Stale state from previous work
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      acceptanceCriteria: [{ id: 1, text: "stale", status: "pass" }],
      currentTaskIndex: 5,
    };

    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      // Select the existing issue (not "Create new...")
      return items.find(i => i.startsWith("#")) ?? items[0];
    };

    const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "list");

    expect(result.activeIssue).toBe(issue.slug);
    expect(result.acceptanceCriteria).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });

  it("new issue resets stale acceptanceCriteria and currentTaskIndex from previous issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    // Simulate stale state from a previous issue
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      acceptanceCriteria: [{ id: 1, text: "stale criterion", status: "pass" }],
      currentTaskIndex: 3,
    };

    const ctx = createMockCtx();
    ctx.ui.input = async () => "New issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "new");

    expect(result.activeIssue).toBeTruthy();
    expect(result.activeIssue).not.toBe("old-issue");
    expect(result.acceptanceCriteria).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });
});
