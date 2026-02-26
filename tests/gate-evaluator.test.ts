// tests/gate-evaluator.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateGate } from "../extensions/megapowers/workflows/gate-evaluator.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import type { GateConfig } from "../extensions/megapowers/workflows/types.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "gate-eval-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "spec",
    ...overrides,
  };
}

describe("evaluateGate — noOpenQuestions", () => {
  it("fails when file has open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Open Questions\n- What about X?");
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("open questions");
  });

  it("passes when file has no open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Open Questions\n*(None)*");
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });

  it("passes when file does not exist (no questions to block on)", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "noOpenQuestions", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});

describe("evaluateGate — requireReviewApproved", () => {
  it("fails when reviewApproved is false", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireReviewApproved" };
    const result = evaluateGate(gate, makeState({ phase: "review", reviewApproved: false }), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("not approved");
  });

  it("passes when reviewApproved is true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireReviewApproved" };
    const result = evaluateGate(gate, makeState({ phase: "review", reviewApproved: true }), store, tmp);
    expect(result.pass).toBe(true);
  });
});

describe("evaluateGate — requireArtifact", () => {
  it("fails when artifact file does not exist", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "requireArtifact", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("spec.md");
  });

  it("passes when artifact file exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "# Spec\nContent here");
    const gate: GateConfig = { type: "requireArtifact", file: "spec.md" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});

describe("evaluateGate — allTasksComplete", () => {
  it("fails when tasks are incomplete", () => {
    const store = createStore(tmp);
    const issueSlug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", issueSlug);
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: First task\n\n### Task 2: Second task\n");

    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement", completedTasks: [1] });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("incomplete");
  });

  it("passes when all tasks are complete", () => {
    const store = createStore(tmp);
    const issueSlug = "001-test";
    const planDir = join(tmp, ".megapowers", "plans", issueSlug);
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: First task\n\n### Task 2: Second task\n");

    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement", completedTasks: [1, 2] });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(true);
  });

  it("fails when no tasks found", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "allTasksComplete" };
    const state = makeState({ phase: "implement" });
    const result = evaluateGate(gate, state, store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("No plan tasks");
  });
});

describe("evaluateGate — alwaysPass", () => {
  it("always returns pass: true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = { type: "alwaysPass" };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
    expect(result.message).toBeUndefined();
  });
});

describe("evaluateGate — custom", () => {
  it("delegates to the custom function and returns its result", () => {
    const store = createStore(tmp);
    const gate: GateConfig = {
      type: "custom",
      evaluate: (_state, _store, _cwd) => ({ pass: false, message: "Custom gate says no" }),
    };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(false);
    expect(result.message).toBe("Custom gate says no");
  });

  it("passes when custom function returns pass: true", () => {
    const store = createStore(tmp);
    const gate: GateConfig = {
      type: "custom",
      evaluate: () => ({ pass: true }),
    };
    const result = evaluateGate(gate, makeState(), store, tmp);
    expect(result.pass).toBe(true);
  });
});
