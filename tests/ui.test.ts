import { describe, it, expect } from "bun:test";
import {
  renderDashboardLines,
  renderStatusText,
  formatPhaseProgress,
  formatIssueListItem,
} from "../extensions/megapowers/ui.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";

// Stub theme — just returns text unformatted
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  strikethrough: (text: string) => text,
};

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
