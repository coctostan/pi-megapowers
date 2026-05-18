import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContextSummary, formatCompactContextStatus, renderContextReport } from "../extensions/megapowers/context-summary.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

function setState(cwd: string, overrides: Partial<MegapowersState>) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    megaEnabled: true,
    ...overrides,
  });
}

describe("context summary derivation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-summary-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("derives workflow, phase, plan mode, task progress, artifacts, and active tool guidance without storing derived prompt text", () => {
    const store = createStore(tmp);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. Works");
    writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
    setState(tmp, {
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      currentTaskIndex: 1,
      completedTasks: [1],
      tddTaskState: { taskIndex: 2, state: "impl-allowed", skipped: false },
    });

    const beforeState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
    const summary = buildContextSummary(tmp, store);
    const status = formatCompactContextStatus(summary);
    const afterState = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");

    expect(afterState).toBe(beforeState);

    expect(summary.workflow).toBe("feature");
    expect(summary.phase).toBe("plan");
    expect(summary.planMode).toBe("draft");
    expect(summary.taskProgress).toEqual({ current: 2, total: 2, completed: 1, tddState: "impl-allowed" });
    expect(summary.artifacts.available).toContain("spec.md");
    expect(summary.artifacts.count).toBeGreaterThanOrEqual(2);
    expect(summary.toolGuidance.active).toContain("prompts/write-plan.md");
    expect(summary.toolGuidance.reference).toContain("docs/phase-tools.md");
    expect(summary.toolGuidance.availabilityNote).toContain("preferred if available");
    expect(status).toContain("feature/plan");
    expect(status).toContain("mode draft");
    expect(status).toContain("task 2/2");
    expect(status).toContain("artifacts");
    expect(JSON.stringify(summary)).not.toContain("You are writing a step-by-step implementation plan");
  });


  it("does not report TDD state from a different task", () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
    setState(tmp, {
      phase: "implement",
      currentTaskIndex: 1,
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });

    const summary = buildContextSummary(tmp);

    expect(summary.taskProgress).toEqual({ current: 2, total: 2, completed: 0, tddState: null });
  });


  it("matches TDD state by derived task id instead of array position", () => {
    const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "task-010.md"), "---\nid: 10\ntitle: Tenth\nstatus: draft\n---\nBody.");
    writeFileSync(join(tasksDir, "task-020.md"), "---\nid: 20\ntitle: Twentieth\nstatus: draft\n---\nBody.");
    setState(tmp, {
      phase: "implement",
      currentTaskIndex: 1,
      tddTaskState: { taskIndex: 20, state: "test-written", skipped: false },
    });

    const summary = buildContextSummary(tmp);

    expect(summary.taskProgress).toEqual({ current: 2, total: 2, completed: 0, tddState: "test-written" });
  });

  it("summarizes plan review guidance without suggesting phase_next", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });

    const summary = buildContextSummary(tmp);

    expect(summary.toolGuidance.active).toContain("prompts/review-plan.md");
    expect(summary.toolGuidance.instructionSummary).toContain("megapowers_plan_review");
    expect(summary.toolGuidance.instructionSummary).not.toContain("phase_next");
  });
});

describe("context summary source diagnostics", () => {
  it("does not keep an unused cwd parameter in deriveGuidance", () => {
    const source = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "context-summary.ts"), "utf-8");

    expect(source).not.toContain("function deriveGuidance(cwd:");
  });
});

describe("context inspection report", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-report-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("renders metadata, active guidance, task/TDD state, and artifact availability without the full prompt", () => {
    const store = createStore(tmp);
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec\n\n## Acceptance Criteria\n1. Works");
    writeFileSync(join(planDir, "plan.md"), "# Plan\n\n### Task 1: First\n\n### Task 2: Second\n");
    setState(tmp, {
      phase: "plan",
      planMode: "draft",
      planIteration: 1,
      currentTaskIndex: 0,
      completedTasks: [],
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });

    const report = renderContextReport(tmp, store);

    expect(report).toContain("Workflow: feature");
    expect(report).toContain("Phase: plan");
    expect(report).toContain("Plan mode: draft");
    expect(report).toContain("Current task: 1/2");
    expect(report).toContain("TDD state: test-written");
    expect(report).toContain("Available artifacts");
    expect(report).toContain("spec.md");
    expect(report).toContain("Tool guidance");
    expect(report).toContain("prompts/write-plan.md");
    expect(report).toContain("docs/phase-tools.md");
    expect(report).toContain("preferred if available");
    expect(report).not.toContain("You are writing a step-by-step implementation plan");
    expect(report).not.toContain("## Megapowers Protocol");
  });
});


describe("context inspection debug report", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "context-debug-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("includes an explicit rendered prompt section only in debug mode", () => {
    const store = createStore(tmp);
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });

    const normal = renderContextReport(tmp, store);
    const debug = renderContextReport(tmp, store, { debug: true });

    expect(normal).not.toContain("## Rendered prompt");
    expect(normal).not.toContain("You are writing a step-by-step implementation plan");
    expect(debug).toContain("## Rendered prompt");
    expect(debug).toContain("You are writing a step-by-step implementation plan");
  });
});
