import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { handlePhaseCommand } from "../extensions/megapowers/commands.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type WorkflowType } from "../extensions/megapowers/state/state-machine.js";
import { writePlanTask } from "../extensions/megapowers/state/plan-store.js";

function seed(tmp: string, phase: any, workflow: WorkflowType = "feature") {
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
  writePlanTask(
    tmp,
    "001-test",
    {
      id: 1,
      title: "Build",
      status: "approved",
      depends_on: [],
      no_test: false,
      files_to_modify: [],
      files_to_create: [],
    },
    "Task body",
  );
}

function makeDeps(): any {
  return {
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

it("commands.ts no longer references legacy VCS deps", () => {
  const source = readFileSync(joinPath(process.cwd(), "extensions/megapowers/commands.ts"), "utf-8");
  const legacyFactory = ["create", "J", "J"].join("");
  expect(source).not.toContain(legacyFactory);
  expect(source).not.toContain("deps.jj");
});
