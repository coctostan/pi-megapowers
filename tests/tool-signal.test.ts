import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal } from "../extensions/megapowers/tools/tool-signal.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import type { JJ } from "../extensions/megapowers/jj.js";

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
  // task_done — jj integration (AC20)
  // ======================================================================

  describe("task_done — jj integration (AC20)", () => {
    function mockJJ(opts: { isJJ?: boolean; newChangeId?: string; diffOutput?: string } = {}): JJ {
      const { isJJ = true, newChangeId = "mock-task-change", diffOutput = "M src/foo.ts" } = opts;
      return {
        isJJRepo: async () => isJJ,
        getCurrentChangeId: async () => "current-id",
        getChangeDescription: async () => "",
        hasConflicts: async () => false,
        newChange: async () => newChangeId,
        describe: async () => {},
        squash: async () => {},
        bookmarkSet: async () => {},
        log: async () => "",
        diff: async () => diffOutput,
        abandon: async () => {},
        squashInto: async () => {},
      };
    }

    it("inspects current task change and creates next task change", async () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
        taskJJChanges: { 1: "change-for-task-1" },
      });

      let diffedChangeId: string | null = null;
      let createdDesc: string | null = null;
      const jj: JJ = {
        ...mockJJ(),
        diff: async (changeId: string) => { diffedChangeId = changeId; return "M src/foo.ts"; },
        newChange: async (desc: string) => { createdDesc = desc; return "new-task-2-change"; },
      };

      const result = handleSignal(tmp, "task_done", jj);
      expect(result.error).toBeUndefined();

      // Wait for async jj ops
      await new Promise(r => setTimeout(r, 50));

      // Should have inspected the current task's change
      expect(diffedChangeId).toBe("change-for-task-1");
      // Should have created a change for the next task
      expect(createdDesc).toContain("task-2");
      // Should have stored the new change ID
      const state = readState(tmp);
      expect(state.taskJJChanges[2]).toBe("new-task-2-change");
    });

    it("jj failures are non-fatal — returns success with warning", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
        taskJJChanges: { 1: "change-1" },
      });

      const jj: JJ = {
        ...mockJJ(),
        diff: async () => { throw new Error("jj broken"); },
        newChange: async () => { throw new Error("jj broken"); },
      };

      const result = handleSignal(tmp, "task_done", jj);
      // Should succeed (not error) even though jj failed
      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("skips jj ops when no jj provided", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });

      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("skips jj when not a jj repo", async () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });

      let diffCalled = false;
      const jj: JJ = {
        ...mockJJ({ isJJ: false }),
        diff: async () => { diffCalled = true; return ""; },
      };

      const result = handleSignal(tmp, "task_done", jj);
      expect(result.error).toBeUndefined();
      await new Promise(r => setTimeout(r, 50));
      expect(diffCalled).toBe(false);
    });
  });

  // ======================================================================
  // tests_failed
  // ======================================================================

  describe("tests_failed", () => {
    it("transitions test-written to impl-allowed during code-review", () => {
      setState(tmp, {
        phase: "code-review",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("RED");

      const state = readState(tmp);
      expect(state.tddTaskState?.state).toBe("impl-allowed");
    });

        it("transitions test-written to impl-allowed during implement", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("RED");

      const state = readState(tmp);
      expect(state.tddTaskState).toEqual({ taskIndex: 1, state: "impl-allowed", skipped: false });
    });

    it("returns error outside implement phase", () => {
      setState(tmp, {
        phase: "brainstorm",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toContain("tests_failed can only be called during the implement or code-review phase");
    });

    it("returns error when tddTaskState is null", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: null,
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toContain("No test written yet");
    });

    it("returns error when already impl-allowed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toContain("already in impl-allowed");
    });

    it("returns error when state is red-pending", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "red-pending", skipped: false },
      });

      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toContain("No test written yet");
    });
  });

  // ======================================================================
  // tests_passed
  // ======================================================================

  describe("tests_passed", () => {
    it("is accepted during code-review and does not change tddTaskState", () => {
      setState(tmp, {
        phase: "code-review",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const before = readState(tmp).tddTaskState;
      const result = handleSignal(tmp, "tests_passed");
      const after = readState(tmp).tddTaskState;

      expect(result.error).toBeUndefined();
      expect(result.message).toContain("GREEN");
      expect(after).toEqual(before);
    });

        it("is accepted during implement and does not change tddTaskState", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const before = readState(tmp).tddTaskState;
      const result = handleSignal(tmp, "tests_passed");
      const after = readState(tmp).tddTaskState;

      expect(result.error).toBeUndefined();
      expect(result.message).toContain("GREEN");
      expect(after).toEqual(before);
    });

    it("returns error outside implement phase", () => {
      setState(tmp, {
        phase: "brainstorm",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });

      const result = handleSignal(tmp, "tests_passed");
      expect(result.error).toContain("tests_passed can only be called during the implement or code-review phase");
    });
  });

  // ======================================================================
  // megapowers_signal schema
  // ======================================================================

  describe("megapowers_signal schema", () => {
    it("includes tests_failed and tests_passed actions", () => {
      // Tool registrations live in register-tools.ts (extracted from index.ts)
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(toolsSource).toContain('Type.Literal("tests_failed")');
      expect(toolsSource).toContain('Type.Literal("tests_passed")');
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
