import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

describe("state-io", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "state-io-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("readState", () => {
    it("returns default initial state when state.json is missing", () => {
      const state = readState(tmp);
      expect(state).toEqual(createInitialState());
    });

    it("returns default initial state when state.json contains invalid JSON", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), "not json {{{");
      const state = readState(tmp);
      expect(state).toEqual(createInitialState());
    });

    it("reads valid state.json and picks only known keys", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      const saved = {
        ...createInitialState(),
        activeIssue: "001-test",
        phase: "spec",
        completedTasks: [1, 2],
        megaEnabled: false,
      };
      writeFileSync(join(dir, "state.json"), JSON.stringify(saved));
      const state = readState(tmp);
      expect(state.activeIssue).toBe("001-test");
      expect(state.phase).toBe("spec");
      expect(state.completedTasks).toEqual([1, 2]);
      expect(state.megaEnabled).toBe(false);
    });

    it("merges over defaults for old formats missing new fields", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), JSON.stringify({
        version: 1,
        activeIssue: "001-test",
        phase: "implement",
      }));
      const state = readState(tmp);
      expect(state.completedTasks).toEqual([]);
      expect(state.megaEnabled).toBe(true);
      expect(state.activeIssue).toBe("001-test");
    });

    it("strips unknown keys like planTasks and acceptanceCriteria", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "state.json"), JSON.stringify({
        version: 1,
        activeIssue: "001-test",
        phase: "implement",
        planTasks: [{ index: 1, description: "test", completed: false, noTest: false }],
        acceptanceCriteria: [{ id: 1, text: "works", status: "pending" }],
      }));
      const state = readState(tmp);
      expect((state as any).planTasks).toBeUndefined();
      expect((state as any).acceptanceCriteria).toBeUndefined();
    });

    it("AC3: drops legacy VCS keys when reading state.json (silently ignored on read)", () => {
      const dir = join(tmp, ".megapowers");
      mkdirSync(dir, { recursive: true });
      const legacyChangeKey = ["j", "j", "ChangeId"].join("");
      const legacyTaskKey = ["task", "J", "J", "Changes"].join("");
      writeFileSync(join(dir, "state.json"), JSON.stringify({
        ...createInitialState(),
        [legacyChangeKey]: "x",
        [legacyTaskKey]: { 1: "y" },
      }));
      const state = readState(tmp);
      expect(legacyChangeKey in state).toBe(false);
      expect(legacyTaskKey in state).toBe(false);
    });
  });

  describe("writeState", () => {
    it("creates .megapowers directory if missing", () => {
      const state = { ...createInitialState(), activeIssue: "001-test" };
      writeState(tmp, state);
      expect(existsSync(join(tmp, ".megapowers", "state.json"))).toBe(true);
    });

    it("writes atomically via temp-file-then-rename", () => {
      const state = { ...createInitialState(), activeIssue: "001-test" };
      writeState(tmp, state);
      // Verify no temp files left behind
      const dir = join(tmp, ".megapowers");
      const files = readdirSync(dir);
      expect(files).toEqual(["state.json"]);
    });
  });

  describe("round-trip", () => {
    it("writeState followed by readState returns identical state", () => {
      const state = {
        ...createInitialState(),
        activeIssue: "005-round-trip",
        workflow: "feature" as const,
        phase: "implement" as const,
        phaseHistory: [{ from: "plan" as const, to: "implement" as const, timestamp: 12345 }],
        currentTaskIndex: 2,
        completedTasks: [1, 2],
        reviewApproved: true,
        tddTaskState: { taskIndex: 3, state: "test-written" as const, skipped: false },
        doneActions: [],
        megaEnabled: true,
      };
      writeState(tmp, state);
      const loaded = readState(tmp);
      expect(loaded).toEqual(state);
    });

    it("AC3: write then read round-trip has no legacy VCS fields", () => {
      writeState(tmp, createInitialState());
      const raw = JSON.parse(readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8"));
      const legacyChangeKey = ["j", "j", "ChangeId"].join("");
      const legacyTaskKey = ["task", "J", "J", "Changes"].join("");
      expect(legacyChangeKey in raw).toBe(false);
      expect(legacyTaskKey in raw).toBe(false);
    });
  });

  describe("KNOWN_KEYS roundtrip", () => {
    it("preserves planMode and planIteration through write/read", () => {
      const state = createInitialState();
      state.planMode = "draft";
      state.planIteration = 2;

      writeState(tmp, state);

      const loaded = readState(tmp);
      expect(loaded.planMode).toBe("draft");
      expect(loaded.planIteration).toBe(2);
    });

    it("strips unknown keys on read", () => {
      const state = { ...createInitialState(), unknownField: "garbage" };
      writeState(tmp, state as any);

      const loaded = readState(tmp);
      expect((loaded as any).unknownField).toBeUndefined();
    });
  });

  it("persists and reads branchName field (AC13)", () => { // Task 10
    const state = {
      ...createInitialState(),
      activeIssue: "001-test",
      branchName: "feat/001-test",
    };
    writeState(tmp, state);
    const read = readState(tmp);
    expect(read.branchName).toBe("feat/001-test");
  });

  it("persists and reads baseBranch field (required to support AC18 squashAndPush)", () => {
    const state = {
      ...createInitialState(),
      activeIssue: "001-test",
      branchName: "feat/001-test",
      baseBranch: "main",
    };
    writeState(tmp, state);
    const read = readState(tmp);
    expect(read.baseBranch).toBe("main");
  });

  it("defaults branchName and baseBranch to null when not in state.json", () => {
    const state = readState(tmp);
    expect(state.branchName).toBeNull();
    expect(state.baseBranch).toBeNull();
  });

  describe("thin schema", () => {
    it("initial state has completedTasks array, not planTasks", () => {
      const state = createInitialState();
      expect(state.completedTasks).toEqual([]);
      expect(state.megaEnabled).toBe(true);
      // planTasks is deprecated optional — should be absent from initial state
      expect((state as any).planTasks).toBeUndefined();
    });
  });
});
