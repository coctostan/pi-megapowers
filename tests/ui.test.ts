import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  renderDashboardLines,
  renderStatusText,
  formatPhaseProgress,
  formatIssueListItem,
  createUI,
  filterTriageableIssues,
  formatTriageIssueList,
  getDoneChecklistItems,
  showDoneChecklist,
} from "../extensions/megapowers/ui.js";
import type { MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/state/store.js";
import type { Issue } from "../extensions/megapowers/state/store.js";

// Shared temp dir for mock contexts that need a cwd for writeState
let mockCwd: string;
beforeEach(() => {
  mockCwd = mkdtempSync(join(tmpdir(), "megapowers-ui-mock-"));
});
afterEach(() => {
  rmSync(mockCwd, { recursive: true, force: true });
});

// Stub theme — just returns text unformatted
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

function createMockCtx(selectReturn?: string, cwd?: string) {
  const notifications: { msg: string; type: string }[] = [];
  const widgets: Record<string, any> = {};
  const statuses: Record<string, any> = {};

  return {
    hasUI: true,
    cwd: cwd ?? mockCwd,
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

async function callIssueCommand(ui: any, ctx: any, state: any, store: any, args: string) {
  return ui.handleIssueCommand(ctx, state, store, args);
}

async function callTriageCommand(ui: any, ctx: any, state: any, store: any) {
  return ui.handleTriageCommand(ctx, state, store);
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

describe("renderDashboardLines — idle mode command hints", () => {
  it("includes /triage command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("/triage");
  });

  it("includes /mega on|off command hint (AC7)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("/mega on|off");
  });

  it("includes ROADMAP.md and milestones.md reference (AC8)", () => {
    const state = createInitialState();
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    expect(joined).toContain("ROADMAP.md");
    expect(joined).toContain(".megapowers/milestones.md");
  });
});

describe("renderDashboardLines — active issue", () => {
  it("shows issue, phase, and task progress", () => {
    const tasks = [
      { index: 1, description: "A", completed: true, noTest: false },
      { index: 2, description: "B", completed: false, noTest: false },
    ];
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth-refactor",
      workflow: "feature",
      phase: "plan",
      completedTasks: [1],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, tasks);
    const joined = lines.join("\n");
    expect(joined).toContain("001-auth-refactor");
    expect(joined).toContain("feature");
    expect(joined).toContain("plan");
    expect(joined).toContain("1/2");
  });
});

it("renderDashboardLines does not show legacy VCS line", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature" as const,
    phase: "implement" as const,
  };
  const lines = renderDashboardLines(state, [], plainTheme as any, []);
  expect(lines.join("\n")).not.toContain("jj:");
});

describe("renderStatusText", () => {
  it("returns empty when no active issue", () => {
    expect(renderStatusText(createInitialState())).toBe("");
  });

  it("returns compact status", () => {
    const tasks = [
      { index: 1, description: "A", completed: true, noTest: false },
      { index: 2, description: "B", completed: false, noTest: false },
      { index: 3, description: "C", completed: false, noTest: false },
    ];
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      completedTasks: [1],
    };
    const text = renderStatusText(state, tasks);
    expect(text).toContain("#001");
    expect(text).toContain("implement");
    expect(text).toContain("1/3");
  });
});

describe("renderDashboardLines — done phase with doneActions", () => {
  it("shows action labels when doneActions is non-empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneActions: ["write-changelog"],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("write-changelog");
  });

  it("shows instruction when doneActions non-empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneActions: ["generate-bugfix-summary"],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n").toLowerCase()).toContain("send");
  });

  it("shows nothing extra when doneActions is empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      phase: "done",
      doneActions: [],
    };
    const linesBefore = renderDashboardLines(state, [], plainTheme as any).length;
    const stateWithActions: MegapowersState = { ...state, doneActions: ["write-changelog"] };
    const linesAfter = renderDashboardLines(stateWithActions, [], plainTheme as any).length;
    expect(linesAfter).toBeGreaterThan(linesBefore);
  });
});

describe("doneActions API cleanup", () => {
  it("createUI does not expose legacy popup handlers", () => {
    const ui = createUI() as any;
    expect(ui.handlePhaseTransition).toBeUndefined();
    expect(ui.handleDonePhase).toBeUndefined();
  });
});


describe("getDoneChecklistItems (AC12)", () => {
  it("feature workflow: returns generate-docs, write-changelog, capture-learnings, close-issue all defaultChecked", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((i) => i.defaultChecked === true)).toBe(true);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("generate-docs");
    expect(keys).toContain("write-changelog");
    expect(keys).toContain("capture-learnings");
    expect(keys).toContain("close-issue");
    expect(keys).not.toContain("generate-bugfix-summary");
  });

  it("bugfix workflow: returns generate-bugfix-summary instead of generate-docs", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("generate-bugfix-summary");
    expect(keys).not.toContain("generate-docs");
    expect(keys).toContain("write-changelog");
    expect(keys).toContain("capture-learnings");
    expect(keys).toContain("close-issue");
    expect(items.every((i) => i.defaultChecked === true)).toBe(true);
  });

  it("getDoneChecklistItems never includes squash-task-changes", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    expect(getDoneChecklistItems(state).map((i) => i.key)).not.toContain("squash-task-changes");
  });

  it("each item has a non-empty key and label", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    for (const item of getDoneChecklistItems(state)) {
      expect(typeof item.key).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(item.key.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("includes push-and-pr item checked by default (AC17)", () => { // Task 11
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    const pushItem = items.find(i => i.key === "push-and-pr");
    expect(pushItem).toBeDefined();
    expect(pushItem!.label).toBe("Push & create PR");
    expect(pushItem!.defaultChecked).toBe(true);
  });

  it("includes push-and-pr in bugfix workflow too (AC17)", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    const keys = items.map(i => i.key);
    expect(keys).toContain("push-and-pr");
  });
});


describe("showDoneChecklist (AC11, AC13, AC14)", () => {
  let tmp2: string;

  beforeEach(() => {
    tmp2 = mkdtempSync(join(tmpdir(), "megapowers-done-"));
  });

  afterEach(() => {
    rmSync(tmp2, { recursive: true, force: true });
  });

  it("stores all default-checked keys when ctx.ui.custom resolves with them (AC13)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) =>
          ["generate-docs", "write-changelog", "capture-learnings", "close-issue"],
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toContain("generate-docs");
    expect(updated.doneActions).toContain("write-changelog");
    expect(updated.doneActions).toContain("capture-learnings");
    expect(updated.doneActions).toContain("close-issue");
  });

  it("stores empty doneActions when ctx.ui.custom resolves with null (Escape) (AC14)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) => null,
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toEqual([]);
  });

  it("stores only the returned subset when user deselects some items (AC13)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) => ["generate-docs", "capture-learnings", "close-issue"],
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).not.toContain("write-changelog");
    expect(updated.doneActions).toContain("generate-docs");
    expect(updated.doneActions).toContain("capture-learnings");
  });

  it("does nothing when not in done phase", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: { custom: async (_fn: any) => ["generate-docs"] },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toEqual([]);
  });

  it("does nothing when no active issue", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      phase: "done",
    };
    writeState(tmp2, state);

    let called = false;
    const ctx = {
      hasUI: true,
      ui: { custom: async (_fn: any) => { called = true; return []; } },
    };

    await showDoneChecklist(ctx as any, tmp2);
    expect(called).toBe(false);
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
      sources: [],
      milestone: "",
      priority: 0,
    });
    expect(result).toContain("#001");
    expect(result).toContain("Auth refactor");
    expect(result).toContain("feature");
    expect(result).toContain("open");
  });
});


describe("renderDashboardLines — implement phase with tasks", () => {
  it("shows per-task progress count", () => {
    const tasks = [
      { index: 1, description: "Set up schema", completed: true, noTest: false },
      { index: 2, description: "Create endpoint", completed: false, noTest: false },
      { index: 3, description: "Write tests", completed: false, noTest: false },
    ];
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1],
      currentTaskIndex: 1,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, tasks);
    const joined = lines.join("\n");
    expect(joined).toContain("1/3");
  });

  it("shows current task name in implement phase", () => {
    const tasks = [
      { index: 1, description: "Set up schema", completed: true, noTest: false },
      { index: 2, description: "Create endpoint", completed: false, noTest: false },
      { index: 3, description: "Write tests", completed: false, noTest: false },
    ];
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1],
      currentTaskIndex: 1,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, tasks);
    const joined = lines.join("\n");
    expect(joined).toContain("Create endpoint");
  });
});

describe("renderDashboardLines — verify phase with criteria", () => {
  it("acceptance criteria are derived on demand (not shown in dashboard)", () => {
    // Acceptance criteria are no longer stored in state — they're derived from spec.md.
    // The dashboard no longer shows criteria counts (removed deprecated acceptanceCriteria field).
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-auth",
      workflow: "feature",
      phase: "verify",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    // Dashboard still shows the verify phase
    expect(joined).toContain("verify");
  });
});


describe("renderDashboardLines — TDD state indicator", () => {
  const implTasks = [{ index: 1, description: "Build auth", completed: false, noTest: false }];
  const noTestTasks = [{ index: 1, description: "Config schema", completed: false, noTest: true }];

  it("shows 🔴 Need test when in no-test state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, implTasks);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toBeDefined();
    expect(tddLine).toContain("🔴");
    expect(tddLine).toContain("Need test");
  });

  it("shows 🟡 Run test when in test-written state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, implTasks);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("🟡");
    expect(tddLine).toContain("Run test");
  });

  it("shows 🟢 Implement when in impl-allowed state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, implTasks);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("🟢");
    expect(tddLine).toContain("Implement");
  });

  it("shows ⚪ Skipped when task is noTest", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: null,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, noTestTasks);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("⚪");
    expect(tddLine).toContain("Skipped");
  });

  it("shows ⚪ Skipped when runtime skip is active", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: true },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any, implTasks);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toContain("⚪");
    expect(tddLine).toContain("Skipped");
  });

  it("does not show TDD indicator when not in implement phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const tddLine = lines.find(l => l.includes("TDD:"));
    expect(tddLine).toBeUndefined();
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

  it("new issue resets currentTaskIndex and completedTasks", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const state = createInitialState();

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.input = async () => "Test issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await callIssueCommand(ui, ctx as any, state, store, "new");

    expect(result.activeIssue).toBeTruthy();
    expect(result.completedTasks).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });

  it("list activation resets completedTasks and currentTaskIndex", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        // Create an existing issue to select from list
    const issue = store.createIssue("Existing feature", "feature", "desc");

    // Stale state from previous work
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1, 2, 3],
      currentTaskIndex: 5,
    };

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      // Select the existing issue (not "Create new...")
      return items.find(i => i.startsWith("#")) ?? items[0];
    };

    const result = await callIssueCommand(ui, ctx as any, state, store, "list");

    expect(result.activeIssue).toBe(issue.slug);
    expect(result.completedTasks).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });

  it("new issue resets stale completedTasks and currentTaskIndex from previous issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        // Simulate stale state from a previous issue
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1, 2],
      currentTaskIndex: 3,
    };

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.input = async () => "New issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await callIssueCommand(ui, ctx as any, state, store, "new");

    expect(result.activeIssue).toBeTruthy();
    expect(result.activeIssue).not.toBe("old-issue");
    expect(result.completedTasks).toEqual([]);
    expect(result.currentTaskIndex).toBe(0);
  });

  it("new issue resets stale tddTaskState from previous issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        // Simulate stale TDD state (impl-allowed) from a previous issue
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 2,
      tddTaskState: { taskIndex: 2, state: "impl-allowed", skipped: false },
    };

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.input = async () => "New issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await callIssueCommand(ui, ctx as any, state, store, "new");

    expect(result.activeIssue).toBeTruthy();
    expect(result.activeIssue).not.toBe("old-issue");
    expect(result.tddTaskState).toBeNull();
  });

  it("list activation resets stale tddTaskState", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const issue = store.createIssue("Another feature", "feature", "desc");

    // Stale TDD state from previous issue
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 3,
      tddTaskState: { taskIndex: 3, state: "impl-allowed", skipped: false },
    };

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.find(i => i.startsWith("#")) ?? items[0];
    };

    const result = await callIssueCommand(ui, ctx as any, state, store, "list");

    expect(result.activeIssue).toBe(issue.slug);
    expect(result.tddTaskState).toBeNull();
  });

  it("new issue resets completedTasks", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      completedTasks: [1, 2],
    };

    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.input = async () => "New issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await callIssueCommand(ui, ctx as any, state, store, "new");

    expect(result.completedTasks).toEqual([]);
  });
});

describe("handleIssueCommand — list filtering", () => {
  // Task 1: /issue list should hide done issues, show only open/in-progress
  // TDD: these tests were written during reproduce and confirmed failing
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-list-filter-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("issue list filters out done issues", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const state = createInitialState();

    // Create 3 issues: mark 2 as done, leave 1 open
    const openIssue = store.createIssue("Open feature", "feature", "still open");
    const doneIssue1 = store.createIssue("Done feature", "feature", "completed");
    store.updateIssueStatus(doneIssue1.slug, "done");
    const doneIssue2 = store.createIssue("Another done", "bugfix", "also completed");
    store.updateIssueStatus(doneIssue2.slug, "done");

    // Capture what items are shown in the select menu
    let selectItems: string[] = [];
    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null; // cancel — we just want to inspect the list
    };

    await callIssueCommand(ui, ctx as any, state, store, "list");

    // Should show only the open issue (plus the "+ Create new issue..." option)
    const issueItems = selectItems.filter(i => i.startsWith("#"));
    expect(issueItems.length).toBe(1);
    expect(issueItems[0]).toContain("Open feature");
    // Done issues should NOT appear
    expect(selectItems.some(i => i.includes("Done feature"))).toBe(false);
    expect(selectItems.some(i => i.includes("Another done"))).toBe(false);
  });

  it("shows 'no issues' message when all issues are done", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const state = createInitialState();

    // Create an issue and mark it done
    const issue = store.createIssue("Completed work", "feature", "done");
    store.updateIssueStatus(issue.slug, "done");

    const ctx = createMockCtx(undefined, tmp);
    await callIssueCommand(ui, ctx as any, state, store, "list");

    // Should notify that there are no (open) issues
    expect(ctx._notifications.some(n => n.msg.toLowerCase().includes("no issues") || n.msg.toLowerCase().includes("no open"))).toBe(true);
  });

  it("shows in-progress issues in the list", async () => {
    const store = createStore(tmp);
    const ui = createUI();
        const state = createInitialState();

    const inProgressIssue = store.createIssue("Active work", "feature", "working on it");
    store.updateIssueStatus(inProgressIssue.slug, "in-progress");

    let selectItems: string[] = [];
    const ctx = createMockCtx(undefined, tmp);
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null;
    };

    await callIssueCommand(ui, ctx as any, state, store, "list");

    const issueItems = selectItems.filter(i => i.startsWith("#"));
    expect(issueItems.length).toBe(1);
    expect(issueItems[0]).toContain("Active work");
  });
});


describe("formatIssueListItem — batch annotation", () => {
  it("appends batch annotation when batchSlug is provided", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [], milestone: "", priority: 0,
    };
    const result = formatIssueListItem(issue, "019-batch-parser-fixes");
    expect(result).toContain("#006");
    expect(result).toContain("Criteria not extracted");
    expect(result).toContain("(in batch 019-batch-parser-fixes)");
  });

  it("does not append annotation when batchSlug is null", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [], milestone: "", priority: 0,
    };
    const result = formatIssueListItem(issue, null);
    expect(result).not.toContain("in batch");
  });

  it("does not append annotation when batchSlug is undefined (backwards compat)", () => {
    const issue: Issue = {
      id: 6, slug: "006-criteria-bug", title: "Criteria not extracted",
      type: "bugfix", status: "open", description: "", createdAt: 0, sources: [], milestone: "", priority: 0,
    };
    const result = formatIssueListItem(issue);
    expect(result).not.toContain("in batch");
  });
});


describe("handleTriageCommand", () => {
  let tmp: string;
  let testStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-triage-"));
    testStore = createStore(tmp);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates a batch issue with sources and activates it", async () => {
    testStore.createIssue("Bug A", "bugfix", "Parser fails");  // id 1
    testStore.createIssue("Feature B", "feature", "Add widget");  // id 2
    testStore.createIssue("Bug C", "bugfix", "Command broken");  // id 3
    // Close one to verify it's excluded
    testStore.updateIssueStatus("002-feature-b", "done");

    const uiInstance = createUI();
    let inputCallCount = 0;
    const ctx = {
      ...createMockCtx(undefined, tmp),
      ui: {
        ...createMockCtx(undefined, tmp).ui,
        select: async (prompt: string, _items: string[]) => {
          if (prompt.toLowerCase().includes("type")) return "bugfix";
          return null;
        },
        input: async (prompt: string) => {
          inputCallCount++;
          if (prompt.toLowerCase().includes("title")) return "Parser batch fix";
          if (prompt.toLowerCase().includes("source")) return "1, 3";
          return null;
        },
        editor: async () => "Combined parser fix",
      },
    };

    const state = createInitialState();
        const result = await callTriageCommand(uiInstance, ctx as any, state, testStore);

    // Should have created a batch issue and activated it
    expect(result.activeIssue).toBeDefined();
    expect(result.activeIssue).not.toBeNull();

    // The created issue should have sources
    if (result.activeIssue) {
      const batchIssue = testStore.getIssue(result.activeIssue);
      expect(batchIssue).not.toBeNull();
      expect(batchIssue!.sources).toEqual([1, 3]);
      expect(batchIssue!.type).toBe("bugfix");
    }
  });

  it("returns unchanged state when user cancels at title input", async () => {
    testStore.createIssue("Bug A", "bugfix", "desc");
    const uiInstance = createUI();
    // Default createMockCtx returns null for input, so title prompt returns null → cancel
    const ctx = createMockCtx(undefined, tmp);

    const state = createInitialState();
        const result = await callTriageCommand(uiInstance, ctx as any, state, testStore);

    expect(result.activeIssue).toBeNull();
  });

  it("displays open issues in notification", async () => {
    testStore.createIssue("Bug A", "bugfix", "Parser fails");
    testStore.createIssue("Bug B", "bugfix", "Command broken");

    const uiInstance = createUI();
    const notifications: string[] = [];
    const ctx = {
      ...createMockCtx(undefined, tmp),
      ui: {
        ...createMockCtx(undefined, tmp).ui,
        notify: (msg: string, _type: string) => notifications.push(msg),
      },
    };

    const state = createInitialState();
        await callTriageCommand(uiInstance, ctx as any, state, testStore);

    // Should have displayed the open issues
    const displayedIssues = notifications.find(n => n.includes("Bug A") || n.includes("#001"));
    expect(displayedIssues).toBeDefined();
  });
});

describe("filterTriageableIssues", () => {
  it("returns open non-batch issues (AC 7)", () => {
    const issues: Issue[] = [
      { id: 1, slug: "001-a", title: "A", type: "bugfix", status: "open", description: "d", sources: [], createdAt: 0, milestone: "", priority: 0 },
      { id: 2, slug: "002-b", title: "B", type: "bugfix", status: "done", description: "d", sources: [], createdAt: 0, milestone: "", priority: 0 },
      { id: 3, slug: "003-c", title: "C", type: "feature", status: "open", description: "d", sources: [1, 2], createdAt: 0, milestone: "", priority: 0 },
      { id: 4, slug: "004-d", title: "D", type: "bugfix", status: "in-progress", description: "d", sources: [], createdAt: 0, milestone: "", priority: 0 },
    ];
    const result = filterTriageableIssues(issues);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.id)).toEqual([1, 4]);
  });

  it("returns empty array when no issues match", () => {
    const result = filterTriageableIssues([]);
    expect(result).toHaveLength(0);
  });
});

describe("formatTriageIssueList", () => {
  it("formats issues with id, title, type, and description (AC 7)", () => {
    const issues: Issue[] = [
      { id: 1, slug: "001-a", title: "Bug A", type: "bugfix", status: "open", description: "Parser fails on edge case", sources: [], createdAt: 0, milestone: "", priority: 0 },
    ];
    const result = formatTriageIssueList(issues);
    expect(result).toContain("#001");
    expect(result).toContain("Bug A");
    expect(result).toContain("bugfix");
    expect(result).toContain("Parser fails");
  });
});
