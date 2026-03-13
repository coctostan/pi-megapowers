import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGate, type GateResult } from "../extensions/megapowers/policy/gates.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { writePlanTask } from "../extensions/megapowers/state/plan-store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { readFileSync } from "node:fs";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "megapowers-gate-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makeState(overrides: Partial<MegapowersState> = {}): MegapowersState {
  return {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  };
}

describe("brainstorm → spec", () => {
  it("always passes (brainstorm is freeform)", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "brainstorm" }), "spec", store);
    expect(result.pass).toBe(true);
  });
});

describe("spec → plan", () => {
  it("fails when spec.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("spec.md");
  });

  it("fails when spec.md has open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Acceptance Criteria\n1. Works\n\n## Open Questions\n- What about X?");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("open questions");
  });

  it("passes when spec.md exists with no open questions", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "spec.md", "## Goal\nBuild it.\n\n## Acceptance Criteria\n1. It works\n\n## Out of Scope\n- Nothing");
    const result = checkGate(makeState({ phase: "spec" }), "plan", store);
    expect(result.pass).toBe(true);
  });
});

describe("plan → implement", () => {
  it("fails when task files do not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "plan" }), "implement", store, tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("task files");
  });

  it("passes when task files exist", () => {
    const store = createStore(tmp);
    writePlanTask(
      tmp,
      "001-test",
      {
        id: 1,
        title: "Do thing",
        status: "approved",
        depends_on: [],
        no_test: false,
        files_to_modify: [],
        files_to_create: [],
      },
      "Details...",
    );
    const result = checkGate(makeState({ phase: "plan" }), "implement", store, tmp);
    expect(result.pass).toBe(true);
  });
});

describe("review phase compatibility", () => {
  it("falls back to allow-by-default when no transition is defined", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "review" }), "implement", store);
    expect(result.pass).toBe(true);
  });
});

describe("implement → verify", () => {
  it("fails when no tasks completed (derived from plan.md)", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "# Plan\n\n### Task 1: A\nDetails\n\n### Task 2: B\nDetails\n");
    const state = makeState({
      phase: "implement",
      completedTasks: [],
    });
    const result = checkGate(state, "verify", store, tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("tasks");
  });

  it("passes when all tasks completed (derived from plan.md)", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "plan.md", "# Plan\n\n### Task 1: A\nDetails\n\n### Task 2: B\nDetails\n");
    const state = makeState({
      phase: "implement",
      completedTasks: [1, 2],
    });
    const result = checkGate(state, "verify", store, tmp);
    expect(result.pass).toBe(true);
  });

  it("fails when plan has zero tasks (no plan.md)", () => {
    const store = createStore(tmp);
    const state = makeState({
      phase: "implement",
      completedTasks: [],
    });
    const result = checkGate(state, "verify", store, tmp);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("tasks");
  });
});

describe("verify → code-review", () => {
  it("fails when verify.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "verify" }), "code-review", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("verify.md");
  });

  it("passes when verify.md exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "verify.md", "## Overall Verdict\npass\n\nAll criteria met.");
    const result = checkGate(makeState({ phase: "verify" }), "code-review", store);
    expect(result.pass).toBe(true);
  });
});

describe("code-review → done", () => {
  it("fails when code-review.md does not exist", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "code-review" }), "done", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("code-review.md");
  });

  it("passes when code-review.md exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "code-review.md", "## Assessment\nready\n\nNo critical issues.");
    const result = checkGate(makeState({ phase: "code-review" }), "done", store);
    expect(result.pass).toBe(true);
  });
});

describe("no active phase or issue", () => {
  it("fails when no active issue", () => {
    const store = createStore(tmp);
    const state = makeState({ activeIssue: null, phase: "brainstorm" });
    const result = checkGate(state, "spec", store);
    expect(result.pass).toBe(false);
  });

  it("fails when no active phase", () => {
    const store = createStore(tmp);
    const state = makeState({ phase: null });
    const result = checkGate(state, "spec", store);
    expect(result.pass).toBe(false);
  });
});

describe("backward transitions pass without gates", () => {
  it("review → plan falls back to allow-by-default when no transition is defined", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "review" }), "plan", store);
    expect(result.pass).toBe(true);
  });

  it("verify → implement always passes", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "verify" }), "implement", store);
    expect(result.pass).toBe(true);
  });

  it("code-review → implement always passes", () => {
    const store = createStore(tmp);
    const result = checkGate(makeState({ phase: "code-review" }), "implement", store);
    expect(result.pass).toBe(true);
  });
});

describe("reproduce → diagnose (bugfix)", () => {
  it("fails when reproduce.md does not exist", () => {
    const store = createStore(tmp);
    const state = makeState({ phase: "reproduce", workflow: "bugfix" });
    const result = checkGate(state, "diagnose", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("reproduce.md");
  });

  it("passes when reproduce.md exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "reproduce.md", "## Steps to Reproduce\n1. Do X\n2. See error");
    const state = makeState({ phase: "reproduce", workflow: "bugfix" });
    const result = checkGate(state, "diagnose", store);
    expect(result.pass).toBe(true);
  });
});

describe("diagnose → plan (bugfix)", () => {
  it("fails when diagnosis.md does not exist", () => {
    const store = createStore(tmp);
    const state = makeState({ phase: "diagnose", workflow: "bugfix" });
    const result = checkGate(state, "plan", store);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("diagnosis.md");
  });

  it("passes when diagnosis.md exists", () => {
    const store = createStore(tmp);
    store.ensurePlanDir("001-test");
    store.writePlanFile("001-test", "diagnosis.md", "## Root Cause\nThe regex is wrong.");
    const state = makeState({ phase: "diagnose", workflow: "bugfix" });
    const result = checkGate(state, "plan", store);
    expect(result.pass).toBe(true);
  });
});

describe("gates.ts refactor verification", () => {
  it("uses workflow config and gate evaluator (no hardcoded switch/case)", () => {
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "policy", "gates.ts"),
      "utf-8",
    );
    expect(source).not.toContain("BACKWARD_TARGETS");
    expect(source).toContain("getWorkflowConfig");
    expect(source).toContain("evaluateGate");
  });
});
