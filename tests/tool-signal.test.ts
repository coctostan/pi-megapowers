import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal } from "../extensions/megapowers/tool-signal.js";
import { readState, writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
}

function writeArtifact(tmp: string, issue: string, filename: string, content: string) {
  const dir = join(tmp, ".megapowers", "plans", issue);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

describe("handleSignal", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "tool-signal-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  // ======================================================================
  // AC13 — null-safety gap: null tddTaskState must block non-[no-test] tasks
  // ======================================================================

  describe("task_done — AC13 null-safety gap", () => {
    it("blocks non-[no-test] task when tddState is null", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("TDD");
    });

    it("blocks when tddState is test-written (not impl-allowed)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("test");
    });

    it("blocks when tddState.taskIndex is for the wrong task (stale state from task 1 applied to task 2)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 1, // Task 2
        completedTasks: [1],
        // tddState for Task 1 (stale) — must NOT satisfy Task 2
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("TDD");
    });

    it("allows when tddState is impl-allowed and taskIndex matches", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n\n### Task 2: More\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
    });

    it("skips TDD check for [no-test] task even with null tddState", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Setup [no-test]\n\n### Task 2: Build\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).completedTasks).toContain(1);
    });

    it("allows when tddState is skipped", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n\n### Task 2: More\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "no-test", skipped: true },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
    });
  });

  // ======================================================================
  // task_done — core behavior
  // ======================================================================

  describe("task_done — core behavior", () => {
    it("when megaEnabled is false, returns error for any action", () => {
      setState(tmp, { phase: "implement", megaEnabled: false });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toContain("disabled");
    });

    it("marks current task complete and advances index (1-based completedTasks)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("Task 2");

      const state = readState(tmp);
      expect(state.completedTasks).toContain(1); // Task 1's PlanTask.index
      expect(state.currentTaskIndex).toBe(1);    // array index 1 = Task 2
    });

    it("auto-advances to verify on final task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Only task\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("verify");

      const state = readState(tmp);
      expect(state.phase).toBe("verify");
      expect(state.completedTasks).toContain(1);
    });

    it("resets tddTaskState for next task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      handleSignal(tmp, "task_done");
      const state = readState(tmp);
      expect(state.tddTaskState).toBeNull();
    });

    it("skips already-completed tasks when advancing index", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [2], // Task 2 already done
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();

      const state = readState(tmp);
      expect(state.completedTasks).toEqual(expect.arrayContaining([1, 2]));
      expect(state.currentTaskIndex).toBe(2); // Skipped Task 2 (already done), landed on Task 3
    });
  });

  // ======================================================================
  // review_approve
  // ======================================================================

  describe("review_approve", () => {
    it("sets reviewApproved in state", () => {
      setState(tmp, { phase: "review" });
      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).reviewApproved).toBe(true);
    });

    it("returns error when megaEnabled is false", () => {
      setState(tmp, { phase: "review", megaEnabled: false });
      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toContain("disabled");
    });
  });

  // ======================================================================
  // phase_next
  // ======================================================================

  describe("phase_next", () => {
    it("advances phase when gate passes", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("spec");
      expect(readState(tmp).phase).toBe("spec");
    });

    it("returns error when gate fails", () => {
      setState(tmp, { phase: "spec" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("spec.md");
    });
  });

  // ======================================================================
  // invalid action
  // ======================================================================

  describe("invalid action", () => {
    it("returns error for unknown action", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "unknown" as any);
      expect(result.error).toBeDefined();
    });
  });
});
