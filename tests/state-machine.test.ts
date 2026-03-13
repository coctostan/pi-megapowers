import { describe, it, expect } from "bun:test";
import {
  createInitialState,
  getValidTransitions,
  getFirstPhase,
  canTransition,
  transition,
  OPEN_ENDED_PHASES,
  MAX_PLAN_ITERATIONS,
  type MegapowersState,
  type Phase,
  type PlanTask,
  type AcceptanceCriterion,
} from "../extensions/megapowers/state/state-machine.js";
import { getWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";

describe("createInitialState", () => {
  it("returns a blank state with no active issue", () => {
    const state = createInitialState();
    expect(state.version).toBe(1);
    expect(state.activeIssue).toBeNull();
    expect(state.workflow).toBeNull();
    expect(state.phase).toBeNull();
    expect(state.phaseHistory).toEqual([]);
    expect(state.completedTasks).toEqual([]);
    expect(state.megaEnabled).toBe(true);
  });
});

it("createInitialState no longer includes reviewApproved", () => {
  const state = createInitialState();
  expect("reviewApproved" in state).toBe(false);
});

it("state-machine delegates plan entry initialization to plan-orchestrator", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/state/state-machine.ts"),
    "utf-8",
  );

  expect(source).toContain('from "../plan-orchestrator.js"');
  expect(source).toContain("initializePlanLoopState");
});

describe("legacy field removal", () => {
  it("createInitialState omits removed VCS keys", () => {
    const state = createInitialState();
    const legacyChangeKey = ["j", "j", "ChangeId"].join("");
    const legacyTaskKey = ["task", "J", "J", "Changes"].join("");
    expect(legacyChangeKey in state).toBe(false);
    expect(legacyTaskKey in state).toBe(false);
  });
});

describe("createInitialState — planMode and planIteration", () => {
  it("returns planMode: null", () => {
    const state = createInitialState();
    expect(state.planMode).toBeNull();
  });

  it("returns planIteration: 0", () => {
    const state = createInitialState();
    expect(state.planIteration).toBe(0);
  });
});

describe("MAX_PLAN_ITERATIONS", () => {
  it("is exported and equals 4", () => {
    expect(MAX_PLAN_ITERATIONS).toBe(4);
  });
});

describe("Phase type — backward compat", () => {
  it("'review' is still a valid Phase value for backward compat", () => {
    const phase: Phase = "review";
    expect(phase).toBe("review");
  });
});


describe("getValidTransitions — feature mode", () => {
  it("brainstorm can go to spec", () => {
    const ts = getValidTransitions("feature", "brainstorm");
    expect(ts).toEqual(["spec"]);
  });

  it("spec can go to plan", () => {
    const ts = getValidTransitions("feature", "spec");
    expect(ts).toEqual(["plan"]);
  });

  it("plan can go directly to implement", () => {
    const ts = getValidTransitions("feature", "plan");
    expect(ts).toEqual(["implement"]);
    expect(ts).toContain("implement");
  });


  it("implement can go to verify", () => {
    const ts = getValidTransitions("feature", "implement");
    expect(ts).toEqual(["verify"]);
  });

  it("verify can go to code-review or implement (backward)", () => {
    const ts = getValidTransitions("feature", "verify");
    expect(ts).toContain("code-review");
    expect(ts).toContain("implement");
    expect(ts).not.toContain("done");
  });

  it("code-review can go to done or implement (backward)", () => {
    const ts = getValidTransitions("feature", "code-review");
    expect(ts).toContain("done");
    expect(ts).toContain("implement");
  });

  it("done has no transitions", () => {
    const ts = getValidTransitions("feature", "done");
    expect(ts).toEqual([]);
  });
});

describe("getValidTransitions — bugfix mode", () => {
  it("reproduce can go to diagnose", () => {
    const ts = getValidTransitions("bugfix", "reproduce");
    expect(ts).toEqual(["diagnose"]);
  });

  it("diagnose can go to plan", () => {
    const ts = getValidTransitions("bugfix", "diagnose");
    expect(ts).toEqual(["plan"]);
  });

  it("plan can go directly to implement", () => {
    const ts = getValidTransitions("bugfix", "plan");
    expect(ts).toEqual(["implement"]);
    expect(ts).toContain("implement");
  });
});

describe("canTransition", () => {
  it("returns true for valid transition", () => {
    expect(canTransition("feature", "brainstorm", "spec")).toBe(true);
  });

  it("returns false for invalid transition", () => {
    expect(canTransition("feature", "brainstorm", "implement")).toBe(false);
  });

  it("returns false for null workflow", () => {
    expect(canTransition(null, "brainstorm", "spec")).toBe(false);
  });
});

describe("transition", () => {
  it("updates phase and appends to phaseHistory", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";
    state.activeIssue = "001-test";

    const next = transition(state, "spec");
    expect(next.phase).toBe("spec");
    expect(next.phaseHistory).toHaveLength(1);
    expect(next.phaseHistory[0].from).toBe("brainstorm");
    expect(next.phaseHistory[0].to).toBe("spec");
    expect(next.phaseHistory[0].timestamp).toBeGreaterThan(0);
  });

  it("throws on invalid transition", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";
    state.activeIssue = "001-test";

    expect(() => transition(state, "implement")).toThrow();
  });

  it("throws when no active issue", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "brainstorm";

    expect(() => transition(state, "spec")).toThrow();
  });

});

describe("transition — planMode hooks", () => {
  it("sets planMode to 'draft' and planIteration to 1 when entering plan phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
      planMode: null,
      planIteration: 0,
    };

    const next = transition(state, "plan" as Phase);
    expect(next.planMode).toBe("draft");
    expect(next.planIteration).toBe(1);
  });

  it("resets planMode to null when leaving plan phase (plan → implement)", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      planMode: "review",
      planIteration: 2,
    };

    const next = transition(state, "implement" as Phase);
    expect(next.planMode).toBeNull();
  });

  it("preserves planMode when transitioning within non-plan phases", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      planMode: null,
      planIteration: 0,
    };

    const next = transition(state, "verify" as Phase);
    expect(next.planMode).toBeNull();
  });
});


describe("createInitialState — new fields", () => {
  it("includes completedTasks and currentTaskIndex", () => {
    const state = createInitialState();
    expect(state.completedTasks).toEqual([]);
    expect(state.currentTaskIndex).toBe(0);
    expect(state.megaEnabled).toBe(true);
  });
});

describe("transition — implement entry behavior", () => {
  it("does not derive currentTaskIndex from deprecated planTasks fallback", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "plan",
      currentTaskIndex: 7,
    };
    (state as any).planTasks = [
      { index: 1, description: "A", completed: false, noTest: false },
    ];

    const next = transition(state, "implement");
    expect(next.currentTaskIndex).toBe(7);
  });
});

describe("transition — backward transitions", () => {

  it("allows verify → implement (fix failures)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "verify";
    state.activeIssue = "001-test";
    const next = transition(state, "implement");
    expect(next.phase).toBe("implement");
  });

  it("allows code-review → implement (fix issues)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "code-review";
    state.activeIssue = "001-test";
    const next = transition(state, "implement");
    expect(next.phase).toBe("implement");
  });

  it("allows verify → code-review (forward)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "verify";
    state.activeIssue = "001-test";
    const next = transition(state, "code-review");
    expect(next.phase).toBe("code-review");
  });

  it("allows code-review → done (forward)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "code-review";
    state.activeIssue = "001-test";
    const next = transition(state, "done");
    expect(next.phase).toBe("done");
  });
});

describe("doneActions field", () => {
  it("initializes to empty array", () => {
    const state = createInitialState();
    expect(state.doneActions).toEqual([]);
    expect((state as any).doneMode).toBeUndefined();
  });

  it("transition resets doneActions to empty array", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneActions: ["generate-docs", "write-changelog"],
    };
    const next = transition(state, "done");
    expect(next.doneActions).toEqual([]);
  });
});

describe("OPEN_ENDED_PHASES", () => {
  it("contains brainstorm, reproduce, and diagnose", () => {
    expect(OPEN_ENDED_PHASES.has("brainstorm")).toBe(true);
    expect(OPEN_ENDED_PHASES.has("reproduce")).toBe(true);
    expect(OPEN_ENDED_PHASES.has("diagnose")).toBe(true);
  });

  it("does not contain gate-driven phases", () => {
    const gateDriven: Phase[] = ["spec", "plan", "review", "implement", "verify", "code-review", "done"];
    for (const phase of gateDriven) {
      expect(OPEN_ENDED_PHASES.has(phase)).toBe(false);
    }
  });

  it("state-machine uses workflow config (no hardcoded transition tables)", () => {
    // After refactor: state-machine.ts should import from workflows/registry
    // and NOT contain hardcoded FEATURE_TRANSITIONS or BUGFIX_TRANSITIONS
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "state", "state-machine.ts"),
      "utf-8",
    );
    expect(source).not.toContain("FEATURE_TRANSITIONS");
    expect(source).not.toContain("BUGFIX_TRANSITIONS");
    expect(source).toContain("getWorkflowConfig");
  });

  it("all open-ended phases have valid forward transitions", () => {
    // Brainstorm is feature-only, reproduce/diagnose are bugfix-only
    expect(getValidTransitions("feature", "brainstorm").length).toBeGreaterThan(0);
    expect(getValidTransitions("bugfix", "reproduce").length).toBeGreaterThan(0);
    expect(getValidTransitions("bugfix", "diagnose").length).toBeGreaterThan(0);
  });
});

describe("doneChecklistShown state field", () => {
  it("createInitialState includes doneChecklistShown: false", () => {
    const state = createInitialState();
    expect(state.doneChecklistShown).toBe(false);
  });

  it("transition resets doneChecklistShown to false on every phase change", () => {
    const base: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneChecklistShown: true,
    };
    const next = transition(base, "done");
    expect(next.doneChecklistShown).toBe(false);
  });
});

