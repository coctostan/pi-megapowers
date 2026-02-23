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
    diff: async () => "",
    abandon: async () => {},
    squashInto: async (_id: string) => {},
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

describe("renderDashboardLines — done phase with doneMode", () => {
  // Task 1: doneMode must be visible in the dashboard
  it("shows active doneMode in dashboard when set", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneMode: "write-changelog",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n");
    // User must see what mode is active so they know what to do next
    expect(joined).toContain("changelog");
  });

  it("shows instruction to send a message when doneMode is active", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneMode: "generate-bugfix-summary",
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    const joined = lines.join("\n").toLowerCase();
    // User must know they need to send a message to trigger generation
    expect(joined).toContain("send");
  });
});

describe("renderStatusText — done phase with doneMode", () => {
  // Task 2: doneMode must be visible in status bar
  it("includes doneMode in status text", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      phase: "done",
      doneMode: "write-changelog",
    };
    const text = renderStatusText(state);
    expect(text).toContain("changelog");
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

describe("handlePhaseTransition — post-transition guidance", () => {
  // Task 1: phase guidance in dashboard
  // Task 2: guidance in transition notification
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-guidance-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("provides phase-specific guidance after transition", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
    };

    const ctx = createMockCtx("spec");
    await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    // After transitioning to "spec", the user should receive guidance about what to do
    // Either via notification or dashboard — must mention sending a message or the phase's purpose
    const allText = ctx._notifications.map(n => n.msg.toLowerCase()).join(" ");
    expect(allText).toContain("send");
  });

  it("shows phase instruction in dashboard after transition", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "brainstorm",
    };

    const ctx = createMockCtx("spec");
    const newState = await ui.handlePhaseTransition(ctx as any, state, store, jj as any);

    // The dashboard should render with guidance for the new phase
    const lines = renderDashboardLines(newState, [], plainTheme as any);
    const joined = lines.join("\n").toLowerCase();
    // Should contain some instruction about what to do in the spec phase
    expect(joined).toContain("send");
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

describe("handleDonePhase", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-done-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("closes issue when 'Close issue' is selected", async () => {
    const store = createStore(tmp);
    const issue = store.createIssue("Test feature", "feature", "desc");
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: issue.slug,
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx();
    ctx.ui.select = async () => "Close issue";

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(result.activeIssue).toBeNull();
    expect(result.phase).toBeNull();
    expect(result.workflow).toBeNull();
    // Verify issue status updated in store
    const issues = store.listIssues();
    const closed = issues.find(i => i.slug === issue.slug);
    expect(closed?.status).toBe("done");
  });

  it("closes issue and resets state when 'Done' is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const issue = store.createIssue("test", "feature", "desc");
    store.updateIssueStatus(issue.slug, "in-progress");
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: issue.slug,
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx();
    ctx.ui.select = async () => "Done — finish without further actions";

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(result.activeIssue).toBeNull();
    expect(result.phase).toBeNull();
    // Issue should be marked done in the store
    const updated = store.listIssues().find(i => i.slug === issue.slug);
    expect(updated?.status).toBe("done");
  });

  it("returns state unchanged when selection is cancelled", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx(); // returns null by default (cancel)
    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(result.activeIssue).toBe("001-test");
    expect(result.phase).toBe("done");
  });

  it("offers squash option when taskJJChanges exist", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: { 1: "abc123", 2: "def456" },
      jjChangeId: "phase-change-id",
    };

    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return "Done — finish without further actions";
    };

    await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(selectItems.some(item => item.toLowerCase().includes("squash"))).toBe(true);
  });

  it("does not offer squash option when no taskJJChanges", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: {},
    };

    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return "Done — finish without further actions";
    };

    await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(selectItems.every(item => !item.toLowerCase().includes("squash"))).toBe(true);
  });

  it("squashes task changes and clears taskJJChanges", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    let squashedInto: string | null = null;
    const jj = {
      ...createMockJJ(),
      squashInto: async (id: string) => { squashedInto = id; },
    };
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: { 1: "abc123" },
      jjChangeId: "phase-change-id",
    };

    let callCount = 0;
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => {
      callCount++;
      if (callCount === 1) return "Squash task changes into phase change";
      return "Done — finish without further actions";
    };

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);

    expect(squashedInto).toBe("phase-change-id");
    expect(result.taskJJChanges).toEqual({});
  });
});

describe("handleDonePhase — doneMode actions", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-donemode-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets doneMode to 'generate-docs' when feature doc is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => "Generate feature doc";

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("generate-docs");
  });

  it("sets doneMode to 'write-changelog' when changelog is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => "Write changelog entry";

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("write-changelog");
  });

  it("sets doneMode to 'capture-learnings' when capture learnings is selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, _items: string[]) => "Capture learnings";

    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("capture-learnings");
  });

  it("menu includes all three doneMode action labels", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };

    let menuItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      menuItems = items;
      return "Done — finish without further actions";
    };

    await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(menuItems).toContain("Generate feature doc");
    expect(menuItems).toContain("Write changelog entry");
    expect(menuItems).toContain("Capture learnings");
  });
});

describe("renderDashboardLines — TDD state indicator", () => {
  it("shows 🔴 Need test when in no-test state", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
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
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
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
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
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
      planTasks: [{ index: 1, description: "Config schema", completed: false, noTest: true }],
      currentTaskIndex: 0,
      tddTaskState: null,
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
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
      planTasks: [{ index: 1, description: "Build auth", completed: false, noTest: false }],
      currentTaskIndex: 0,
      tddTaskState: { taskIndex: 1, state: "no-test", skipped: true },
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
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

  it("new issue resets stale tddTaskState from previous issue", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    // Simulate stale TDD state (impl-allowed) from a previous issue
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      currentTaskIndex: 2,
      tddTaskState: { taskIndex: 2, state: "impl-allowed", skipped: false },
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
    expect(result.tddTaskState).toBeNull();
  });

  it("list activation resets stale tddTaskState", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
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

    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.find(i => i.startsWith("#")) ?? items[0];
    };

    const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "list");

    expect(result.activeIssue).toBe(issue.slug);
    expect(result.tddTaskState).toBeNull();
  });

  it("new issue resets taskJJChanges", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "old-issue",
      workflow: "feature",
      phase: "implement",
      taskJJChanges: { 1: "stale-change" },
    };

    const ctx = createMockCtx();
    ctx.ui.input = async () => "New issue";
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      return items.includes("feature") ? "feature" : items[0];
    };
    ctx.ui.editor = async () => "description";

    const result = await ui.handleIssueCommand(ctx as any, state, store, jj as any, "new");

    expect(result.taskJJChanges).toEqual({});
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
    const jj = createMockJJ();
    const state = createInitialState();

    // Create 3 issues: mark 2 as done, leave 1 open
    const openIssue = store.createIssue("Open feature", "feature", "still open");
    const doneIssue1 = store.createIssue("Done feature", "feature", "completed");
    store.updateIssueStatus(doneIssue1.slug, "done");
    const doneIssue2 = store.createIssue("Another done", "bugfix", "also completed");
    store.updateIssueStatus(doneIssue2.slug, "done");

    // Capture what items are shown in the select menu
    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null; // cancel — we just want to inspect the list
    };

    await ui.handleIssueCommand(ctx as any, state, store, jj as any, "list");

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
    const jj = createMockJJ();
    const state = createInitialState();

    // Create an issue and mark it done
    const issue = store.createIssue("Completed work", "feature", "done");
    store.updateIssueStatus(issue.slug, "done");

    const ctx = createMockCtx();
    await ui.handleIssueCommand(ctx as any, state, store, jj as any, "list");

    // Should notify that there are no (open) issues
    expect(ctx._notifications.some(n => n.msg.toLowerCase().includes("no issues") || n.msg.toLowerCase().includes("no open"))).toBe(true);
  });

  it("shows in-progress issues in the list", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const state = createInitialState();

    const inProgressIssue = store.createIssue("Active work", "feature", "working on it");
    store.updateIssueStatus(inProgressIssue.slug, "in-progress");

    let selectItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectItems = items;
      return null;
    };

    await ui.handleIssueCommand(ctx as any, state, store, jj as any, "list");

    const issueItems = selectItems.filter(i => i.startsWith("#"));
    expect(issueItems.length).toBe(1);
    expect(issueItems[0]).toContain("Active work");
  });
});

describe("handleDonePhase — bugfix workflow", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-bugfix-done-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("shows bugfix menu items when workflow is bugfix", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    let menuItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      menuItems = items;
      return "Done — finish without further actions";
    };
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(menuItems).toContain("Generate bugfix summary");
    expect(menuItems).not.toContain("Generate feature doc");
    expect(menuItems).toContain("Write changelog entry");
    expect(menuItems).toContain("Capture learnings");
    expect(menuItems).toContain("Close issue");
  });

  it("sets doneMode to 'generate-bugfix-summary' when selected", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const ctx = createMockCtx();
    ctx.ui.select = async () => "Generate bugfix summary";
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    const result = await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(result.doneMode).toBe("generate-bugfix-summary");
  });

  it("notifies user when bugfix summary mode is active", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    const ctx = createMockCtx();
    ctx.ui.select = async () => "Generate bugfix summary";
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    await ui.handleDonePhase(ctx as any, state, store, jj as any);
    const msgs = (ctx._notifications as Array<{msg: string, type: string}>).map(n => n.msg);
    expect(msgs.some(m => m.toLowerCase().includes("bugfix summary"))).toBe(true);
  });

  it("still shows feature menu when workflow is feature", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const jj = createMockJJ();
    let menuItems: string[] = [];
    const ctx = createMockCtx();
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      menuItems = items;
      return "Done — finish without further actions";
    };
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    await ui.handleDonePhase(ctx as any, state, store, jj as any);
    expect(menuItems).toContain("Generate feature doc");
    expect(menuItems).not.toContain("Generate bugfix summary");
  });
});
