import { describe, it, expect } from "bun:test";
import {
  createSatelliteTddState,
  handleSatelliteToolCall,
} from "../extensions/megapowers/satellite-tdd.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import type { MegapowersState } from "../extensions/megapowers/state-machine.js";

function makeImplementState(overrides: Partial<MegapowersState> = {}): Readonly<MegapowersState> {
  return Object.freeze({
    ...createInitialState(),
    activeIssue: "001-test",
    phase: "implement" as const,
    planTasks: [{ index: 1, description: "Add feature", completed: false, noTest: false }],
    currentTaskIndex: 0,
    ...overrides,
  });
}

describe("createSatelliteTddState", () => {
  it("initializes from parent tddTaskState when present", () => {
    const state = makeImplementState({
      tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
    });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toEqual({ taskIndex: 1, state: "test-written", skipped: false });
  });

  it("creates default no-test state when parent has no tddTaskState", () => {
    const state = makeImplementState({ tddTaskState: null });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toEqual({ taskIndex: 1, state: "no-test", skipped: false });
  });

  it("returns null when not in implement phase", () => {
    const state = makeImplementState({ phase: "plan" as any });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toBeNull();
  });

  it("returns null when no tasks", () => {
    const state = makeImplementState({ planTasks: [] });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toBeNull();
  });

  it("returns null when currentTaskIndex is out of bounds", () => {
    const state = makeImplementState({ currentTaskIndex: 5 });
    const tdd = createSatelliteTddState(state);
    expect(tdd).toBeNull();
  });
});

describe("handleSatelliteToolCall", () => {
  it("returns null for non-write/edit tools", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    const result = handleSatelliteToolCall("bash", undefined, state, tdd);
    expect(result).toBeNull();
  });

  it("allows test file writes and advances state to test-written", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    expect(tdd.state).toBe("no-test");

    const result = handleSatelliteToolCall("write", "tests/feature.test.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(false);
    expect(tdd.state).toBe("test-written");
  });

  it("blocks production file writes when state is no-test", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;

    const result = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("TDD");
  });

  it("blocks production file writes when state is test-written", () => {
    const state = makeImplementState();
    const tdd = { ...createSatelliteTddState(state)!, state: "test-written" as const };

    const result = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
  });

  it("allows production file writes when state is impl-allowed", () => {
    const state = makeImplementState();
    const tdd = { ...createSatelliteTddState(state)!, state: "impl-allowed" as const };

    const result = handleSatelliteToolCall("edit", "src/feature.ts", state, tdd);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(false);
  });

  it("returns null when no filePath provided", () => {
    const state = makeImplementState();
    const tdd = createSatelliteTddState(state)!;
    const result = handleSatelliteToolCall("write", undefined, state, tdd);
    expect(result).toBeNull();
  });

  it("returns null when currentTaskIndex is out of bounds", () => {
    const state = makeImplementState({ currentTaskIndex: 5 });
    const tdd = { taskIndex: 1, state: "no-test" as const, skipped: false };
    const result = handleSatelliteToolCall("write", "src/feature.ts", state, tdd);
    expect(result).toBeNull();
  });
});
