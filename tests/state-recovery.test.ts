import { describe, it, expect } from "bun:test";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";
import { resolveStartupState } from "../extensions/megapowers/state-recovery.js";

describe("resolveStartupState", () => {
  it("uses file state when it has an active issue (state.json is authoritative)", () => {
    const fileState: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "verify",
      workflow: "feature",
    };
    const sessionState: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      workflow: "feature",
    };
    const result = resolveStartupState(fileState, [sessionState]);
    expect(result.phase).toBe("verify");
  });

  it("ignores session entries when file state has no active issue (no resurrection)", () => {
    const fileState = createInitialState();
    const sessionState: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      workflow: "feature",
    };
    const result = resolveStartupState(fileState, [sessionState]);
    expect(result.phase).toBeNull();
    expect(result.activeIssue).toBeNull();
  });

  it("ignores multiple session entries — file state always wins", () => {
    const fileState = createInitialState();
    const session1: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "plan",
      workflow: "feature",
    };
    const session2: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "implement",
      workflow: "feature",
    };
    const result = resolveStartupState(fileState, [session1, session2]);
    expect(result.phase).toBeNull();
    expect(result.activeIssue).toBeNull();
  });

  it("returns file state as-is when no session entries exist", () => {
    const fileState: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      phase: "verify",
      workflow: "feature",
    };
    const result = resolveStartupState(fileState, []);
    expect(result.phase).toBe("verify");
  });
});
