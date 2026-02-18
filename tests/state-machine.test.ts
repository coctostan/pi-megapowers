import { describe, it, expect } from "bun:test";
import {
  createInitialState,
  getValidTransitions,
  canTransition,
  transition,
  type MegapowersState,
  type PlanTask,
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
    expect(state.planTasks).toEqual([]);
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

  it("review can go to implement", () => {
    const ts = getValidTransitions("feature", "review");
    expect(ts).toEqual(["implement"]);
  });

  it("implement can go to verify", () => {
    const ts = getValidTransitions("feature", "implement");
    expect(ts).toEqual(["verify"]);
  });

  it("verify can go to done", () => {
    const ts = getValidTransitions("feature", "verify");
    expect(ts).toEqual(["done"]);
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
