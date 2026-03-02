import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handlePlanReview } from "../extensions/megapowers/tools/tool-plan-review.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { readPlanTask } from "../extensions/megapowers/state/plan-store.js";
import type { EntityDoc } from "../extensions/megapowers/state/entity-parser.js";
import type { PlanTask } from "../extensions/megapowers/state/plan-schemas.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function createTaskFile(tmp: string, id: number, title: string) {
  const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `task-${String(id).padStart(3, "0")}.md`),
    `---\nid: ${id}\ntitle: ${title}\nstatus: draft\n---\nBody for task ${id}.`,
  );
}

describe("handlePlanReview — phase validation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when not in plan phase", () => {
    setState(tmp, { phase: "implement", planMode: null });
    const result = handlePlanReview(tmp, { verdict: "approve", feedback: "OK" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("plan phase");
  });

  it("returns error when planMode is not review", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
    const result = handlePlanReview(tmp, { verdict: "approve", feedback: "OK" });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("review");
  });
});

describe("handlePlanReview — revise verdict", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-revise-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets planMode to revise and bumps iteration", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Task 2 needs work.",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("REVISE");

    const state = readState(tmp);
    expect(state.planMode).toBe("revise");
    expect(state.planIteration).toBe(2);
  });

  it("updates task statuses per verdict arrays", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Revise task 2.",
      approved_tasks: [1],
      needs_revision_tasks: [2],
    });

    const t1 = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    const t2 = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(t1.data.status).toBe("approved");
    expect(t2.data.status).toBe("needs_revision");
  });

  it("returns error at iteration cap (MAX_PLAN_ITERATIONS = 4)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 4 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Still needs work.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("4 iterations");
    expect(result.error).toContain("intervention");
  });

  it("sets triggerNewSession flag on revise", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Fix it.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.triggerNewSession).toBe(true);
  });
});


describe("handlePlanReview — approve verdict", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-plan-review-approve-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("sets all task statuses to approved", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Looks great.",
      approved_tasks: [1, 2],
      needs_revision_tasks: [],
    });

    const t1 = readPlanTask(tmp, "001-test", 1) as EntityDoc<PlanTask>;
    const t2 = readPlanTask(tmp, "001-test", 2) as EntityDoc<PlanTask>;
    expect(t1.data.status).toBe("approved");
    expect(t2.data.status).toBe("approved");
  });

  it("generates plan.md file", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "First task");
    createTaskFile(tmp, 2, "Second task");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Approved.",
      approved_tasks: [1, 2],
    });

    const planPath = join(tmp, ".megapowers", "plans", "001-test", "plan.md");
    expect(existsSync(planPath)).toBe(true);
    const content = readFileSync(planPath, "utf-8");
    expect(content).toContain("### Task 1: First task");
    expect(content).toContain("### Task 2: Second task");
  });

  it("advances to implement phase", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Good.",
      approved_tasks: [1],
    });

    const state = readState(tmp);
    expect(state.phase).toBe("implement");
    expect(state.planMode).toBeNull();
  });

  it("returns success message with task count", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    createTaskFile(tmp, 2, "T2");

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "All good.",
      approved_tasks: [1, 2],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("approved");
    expect(result.message).toContain("2");
    expect(result.message).toContain("implement");
  });
});
