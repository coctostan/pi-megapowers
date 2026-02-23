import { describe, it, expect } from "bun:test";
import {
  createInitialState,
  getValidTransitions,
  canTransition,
  transition,
  OPEN_ENDED_PHASES,
  type MegapowersState,
  type Phase,
  type PlanTask,
  type AcceptanceCriterion,
} from "../extensions/megapowers/state-machine.js";

describe("createInitialState", () => {
  it("returns a blank state with no active issue", () => {
    const state = createInitialState();
    expect(state.version).toBe(1);
    expect(state.activeIssue).toBeNull();
    expect(state.workflow).toBeNull();
    expect(state.phase).toBeNull();
    expect(state.phaseHistory).toEqual([]);
    expect(state.reviewApproved).toBe(false);
    expect(state.completedTasks).toEqual([]);
    expect(state.megaEnabled).toBe(true);
    expect(state.jjChangeId).toBeNull();
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

  it("plan can go to review or implement", () => {
    const ts = getValidTransitions("feature", "plan");
    expect(ts).toContain("review");
    expect(ts).toContain("implement");
  });

  it("review can go to implement or plan (backward)", () => {
    const ts = getValidTransitions("feature", "review");
    expect(ts).toContain("implement");
    expect(ts).toContain("plan");
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

  it("plan can go to review or implement", () => {
    const ts = getValidTransitions("bugfix", "plan");
    expect(ts).toContain("review");
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

  it("resets reviewApproved when entering plan phase", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "spec";
    state.activeIssue = "001-test";
    state.reviewApproved = true;

    const next = transition(state, "plan");
    expect(next.reviewApproved).toBe(false);
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

describe("transition — taskJJChanges reset", () => {
  it("resets taskJJChanges when transitioning to implement", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "review",
      reviewApproved: true,
      taskJJChanges: { 1: "old-change", 2: "old-change-2" },
      planTasks: [
        { index: 1, description: "A", completed: false, noTest: false },
      ],
    };

    const next = transition(state, "implement");
    expect(next.taskJJChanges).toEqual({});
  });

  it("preserves taskJJChanges when transitioning to non-implement phase", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      taskJJChanges: { 1: "change-a" },
      planTasks: [
        { index: 1, description: "A", completed: true, noTest: false },
      ],
    };

    const next = transition(state, "verify");
    expect(next.taskJJChanges).toEqual({ 1: "change-a" });
  });
});

describe("transition — backward transitions", () => {
  it("allows review → plan (revise)", () => {
    const state = createInitialState();
    state.workflow = "feature";
    state.phase = "review";
    state.activeIssue = "001-test";
    const next = transition(state, "plan");
    expect(next.phase).toBe("plan");
    expect(next.reviewApproved).toBe(false);
  });

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

describe("doneMode field", () => {
  it("initializes to null", () => {
    const state = createInitialState();
    expect(state.doneMode).toBeNull();
  });

  it("is included in the state type (TypeScript compile check via assignment)", () => {
    const state = createInitialState();
    const copy: MegapowersState = { ...state, doneMode: "generate-docs" };
    expect(copy.doneMode).toBe("generate-docs");
  });

  it("transition to non-done phase resets doneMode to null", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneMode: "generate-docs",
    };
    const next = transition(state, "done");
    expect(next.doneMode).toBeNull();
  });
});

describe("MegapowersState — doneMode type", () => {
  it("accepts generate-bugfix-summary as a valid doneMode", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      doneMode: "generate-bugfix-summary",
    };
    expect(state.doneMode).toBe("generate-bugfix-summary");
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

  it("all open-ended phases have valid forward transitions", () => {
    // Brainstorm is feature-only, reproduce/diagnose are bugfix-only
    expect(getValidTransitions("feature", "brainstorm").length).toBeGreaterThan(0);
    expect(getValidTransitions("bugfix", "reproduce").length).toBeGreaterThan(0);
    expect(getValidTransitions("bugfix", "diagnose").length).toBeGreaterThan(0);
  });
});
