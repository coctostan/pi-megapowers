import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePhaseCommand } from "../extensions/megapowers/commands.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function seed(tmp: string, phase: any, workflow = "feature") {
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow,
    phase,
    completedTasks: [1],
    megaEnabled: true,
  });
  const dir = join(tmp, ".megapowers", "plans", "001-test");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plan.md"), "# Plan\n\n### Task 1: Build\n");
}

function makeDeps(): any {
  return {
    jj: undefined,
    store: { listIssues: () => [] } as any,
    ui: { renderDashboard: () => {} } as any,
    pi: { getActiveTools: () => [], setActiveTools: () => {} } as any,
  };
}

describe("handlePhaseCommand with target", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "phase-cmd-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("/phase implement transitions code-review → implement", async () => {
    seed(tmp, "code-review");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("implement", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("implement");
    expect(notices.some(n => n.includes("Phase advanced"))).toBe(true);
  });

  it("/phase implement transitions plan → implement", async () => {
    seed(tmp, "plan");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };
    await handlePhaseCommand("implement", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("implement");
  });

  it("/phase with no arg shows status (existing behavior preserved)", async () => {
    seed(tmp, "implement");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };

    await handlePhaseCommand("", ctx, makeDeps());
    expect(notices.some(n => n.includes("Phase: implement"))).toBe(true);
  });

  it("/phase next still works (existing behavior preserved)", async () => {
    seed(tmp, "plan");
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (m: string) => notices.push(m) } };
    await handlePhaseCommand("next", ctx, makeDeps());
    expect(readState(tmp).phase).toBe("implement");
  });
});
