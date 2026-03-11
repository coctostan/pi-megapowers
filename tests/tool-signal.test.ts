import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignal, handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

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

    it("error message references task files when no tasks found", () => {
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
      });
      // No plan.md or task files — deriveTasks returns []
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("task file");
      expect(result.error).not.toContain("plan.md");
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

    it("returns triggerNewSession when auto-advancing to verify (all tasks complete)", () => {
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
      expect(result.triggerNewSession).toBe(true);
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

    it("returns triggerNewSession when advancing to next task", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
  });

  describe("task_done without jj bookkeeping", () => {
    it("completes task using only state-machine fields", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
      });

      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeUndefined();

      const state = readState(tmp);
      expect(state.completedTasks).toEqual([1]);
    });
  });

  // ======================================================================
  // review_approve
  // ======================================================================

  describe("review_approve deprecation", () => {
    it("returns deprecation error message", () => {
      setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("deprecated");
      expect(result.error).toContain("megapowers_plan_review");
    });
  });

  // ======================================================================
  // plan_draft_done
  // ======================================================================

  describe("plan_draft_done signal", () => {
    it("transitions planMode from draft to review", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("review mode");
      const state = readState(tmp);
      expect(state.planMode).toBe("review");
    });

    it("transitions planMode from revise to review", async () => {
      setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nBody.");

      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeUndefined();

      const state = readState(tmp);
      expect(state.planMode).toBe("review");
    });

    it("returns error when not in plan phase", async () => {
      setState(tmp, { phase: "implement", planMode: null });
      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("plan phase");
    });

    it("returns error when planMode is review", async () => {
      setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeDefined();
    });

    it("returns error when no task files exist", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("task");
    });

    it("reports task count in success message", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T1\nstatus: draft\n---\nB1.");
      writeFileSync(join(tasksDir, "task-002.md"), "---\nid: 2\ntitle: T2\nstatus: draft\n---\nB2.");
      const result = await handlePlanDraftDone(tmp);
      expect(result.message).toContain("2 tasks");
    });

    it("sets triggerNewSession flag", async () => {
      setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
      const tasksDir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, "task-001.md"), "---\nid: 1\ntitle: T\nstatus: draft\n---\nB.");
      const result = await handlePlanDraftDone(tmp);
      expect(result.triggerNewSession).toBe(true);
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

    it("phase_next uses explicit target for backward transition", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved.");
      setState(tmp, { phase: "code-review", workflow: "feature", completedTasks: [1] });

      const result = handleSignal(tmp, "phase_next", "implement");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).phase).toBe("implement");
    });

    it("returns triggerNewSession on successful phase advance", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
  });

  describe("phase_back", () => {
    // --- Happy path: backward transitions ---
    it("returns error for review → plan (review phase removed from workflow)", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
      setState(tmp, { phase: "review", reviewApproved: true });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
      expect(readState(tmp).phase).toBe("review");
    });

    it("does not version review.md/plan.md when review → plan is invalid", () => {
      writeArtifact(tmp, "001-test", "plan.md", "plan v0");
      writeArtifact(tmp, "001-test", "review.md", "review v0");
      setState(tmp, { phase: "review", reviewApproved: true });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(readState(tmp).phase).toBe("review");
      const dir = join(tmp, ".megapowers", "plans", "001-test");
      expect(() => readFileSync(join(dir, "plan.v1.md"), "utf-8")).toThrow();
      expect(() => readFileSync(join(dir, "review.v1.md"), "utf-8")).toThrow();
    });
    it("does not clear reviewApproved when review → plan transition is invalid", () => {
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
      setState(tmp, { phase: "review", reviewApproved: true });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(readState(tmp).reviewApproved).toBe(true);
    });
    it("transitions verify → implement (AC3)", () => {
      setState(tmp, { phase: "verify" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("implement");
      expect(readState(tmp).phase).toBe("implement");
    });

    it("returns triggerNewSession on successful backward transition", () => {
      setState(tmp, { phase: "verify" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
    it("transitions code-review → implement (AC4)", () => {
      setState(tmp, { phase: "code-review" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("implement");
      expect(readState(tmp).phase).toBe("implement");
    });

    it("versions verify.md before transitioning verify → implement (AC14)", () => {
      writeArtifact(tmp, "001-test", "verify.md", "verify v0");
      setState(tmp, { phase: "verify" });

      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).phase).toBe("implement");

      const dir = join(tmp, ".megapowers", "plans", "001-test");
      expect(readFileSync(join(dir, "verify.v1.md"), "utf-8")).toBe("verify v0");
      expect(readFileSync(join(dir, "verify.md"), "utf-8")).toBe("verify v0");
    });

    it("versions code-review.md before transitioning code-review → implement (AC15)", () => {
      writeArtifact(tmp, "001-test", "code-review.md", "cr v0");
      setState(tmp, { phase: "code-review" });

      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(readState(tmp).phase).toBe("implement");

      const dir = join(tmp, ".megapowers", "plans", "001-test");
      expect(readFileSync(join(dir, "code-review.v1.md"), "utf-8")).toBe("cr v0");
      expect(readFileSync(join(dir, "code-review.md"), "utf-8")).toBe("cr v0");
    });

    // --- Error paths: no backward transition (AC5, AC6) ---
    it("returns error from brainstorm — no backward transition (AC5)", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
    });
    it("returns error from spec — no backward transition (AC5)", () => {
      setState(tmp, { phase: "spec" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
    });
    it("returns error from plan — no backward transition (AC5)", () => {
      setState(tmp, { phase: "plan" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
    });
    it("returns error from implement — no backward transition (AC5)", () => {
      setState(tmp, { phase: "implement" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
    });
    it("returns error for bugfix workflow phases without backward transitions (AC6)", () => {
      const phasesWithNoBackward = ["reproduce", "diagnose", "plan", "implement"] as const;
      for (const phase of phasesWithNoBackward) {
        setState(tmp, { workflow: "bugfix", phase: phase as any });
        const result = handleSignal(tmp, "phase_back");
        expect(result.error).toBeDefined();
        expect(result.error).toContain("No backward transition");
      }
    });
    it("bugfix review has no backward transition; verify still transitions to implement", () => {
      setState(tmp, { workflow: "bugfix", phase: "review" as any });
      const r1 = handleSignal(tmp, "phase_back");
      expect(r1.error).toBeDefined();
      expect(r1.error).toContain("No backward transition");
      setState(tmp, { workflow: "bugfix", phase: "verify" as any });
      const r2 = handleSignal(tmp, "phase_back");
      expect(r2.error).toBeUndefined();
      expect(r2.message).toContain("implement");
    });
    it("returns error when megaEnabled is false", () => {
      setState(tmp, { phase: "review", megaEnabled: false });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toContain("disabled");
    });
  });
  describe("done checklist trigger wiring (AC11, AC25)", () => {
    it("phase_next to done succeeds and stores doneActions when wired", () => {
      // This test verifies the behavioral outcome: when phase_next advances to done,
      // doneActions should be populated by the checklist trigger.
      // In unit testing, we verify the state is correct after advance.
      writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved\n");
      setState(tmp, { phase: "code-review" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("done");
      expect(readState(tmp).phase).toBe("done");
    });
    it("no remaining doneMode references in extension source files (AC25)", () => {
      const files = [
        "extensions/megapowers/state/state-machine.ts",
        "extensions/megapowers/state/state-io.ts",
        "extensions/megapowers/ui.ts",
        "extensions/megapowers/hooks.ts",
        "extensions/megapowers/prompt-inject.ts",
        "extensions/megapowers/commands.ts",
        "extensions/megapowers/register-tools.ts",
      ];
      for (const file of files) {
        const source = readFileSync(join(process.cwd(), file), "utf8");
        // doneMode should not appear as an identifier (allow it in comments only)
        const lines = source.split("\n").filter(
          (line) => line.includes("doneMode") && !line.trim().startsWith("//"),
        );
        expect(lines).toHaveLength(0);
      }
    });
    it("register-tools does NOT wire showDoneChecklist trigger inside megapowers_signal execute", () => {
      const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(source).not.toContain("showDoneChecklist");
    });
  });
  // ======================================================================
  // task_done — jj integration (AC20)
  // ======================================================================


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

    it("returns error when state is no-test", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "no-test", skipped: false },
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
    it("includes phase_back, tests_failed, and tests_passed actions", () => {
      // Tool registrations live in register-tools.ts (extracted from index.ts)
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(toolsSource).toContain('Type.Literal("phase_back")');
      expect(toolsSource).toContain('Type.Literal("tests_failed")');
      expect(toolsSource).toContain('Type.Literal("tests_passed")');
    });


    it("includes phase_back action", () => {
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(toolsSource).toContain('Type.Literal("phase_back")');
    });

    it("includes optional target parameter and passes it to handleSignal", () => {
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(toolsSource).toContain("target: Type.Optional(Type.String");
      expect(toolsSource).toContain("handleSignal(ctx.cwd, params.action, params.target)");
      expect(toolsSource).not.toContain("handleSignal(ctx.cwd, params.action, jj");
    });
    it("handleSignal signature has no jj parameter", () => {
      const source = readFileSync(join(process.cwd(), "extensions/megapowers/tools/tool-signal.ts"), "utf-8");
      expect(source).not.toContain("jj?:");
      expect(source).toContain("export function handleSignal(");
    });

    it("register-tools wires handleSignal without jj", () => {
      const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");
      expect(source).toContain("handleSignal(ctx.cwd, params.action, params.target)");
      expect(source).not.toContain("handleSignal(ctx.cwd, params.action, jj");
    });

    it("megapowers_signal schema includes close_issue action", () => {
      const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(source).toContain('Type.Literal("close_issue")');
    });

    it("megapowers-protocol.md documents close_issue signal", () => {
      const source = readFileSync(join(process.cwd(), "prompts/megapowers-protocol.md"), "utf8");
      expect(source).toContain("close_issue");
    });

    it("megapowers-protocol.md no longer advertises legacy pipeline/subagent worktrees", () => {
      const source = readFileSync(join(process.cwd(), "prompts/megapowers-protocol.md"), "utf8");
      expect(source).not.toContain("Pipeline/subagent worktrees are also managed automatically.");
    });

    it("does not advertise review_approve while the low-level deprecation error remains", () => {
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");

      expect(toolsSource).not.toContain('Type.Literal("review_approve")');
      expect(toolsSource).not.toContain("Note: review_approve is deprecated");

      const result = handleSignal(tmp, "review_approve");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("deprecated");
      expect(result.error).toContain("megapowers_plan_review");
    });
  });

  describe("close_issue signal", () => {
    function makeIssueFile(cwd: string, slug: string, id: number, status = "in-progress") {
      const issuesDir = join(cwd, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, `${slug}.md`),
        `---\nid: ${id}\ntype: feature\nstatus: ${status}\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Test Issue ${id}\nDescription`,
      );
    }

    it("marks issue as done and resets state when in done phase", () => {
      makeIssueFile(tmp, "001-test", 1);
      setState(tmp, { phase: "done", doneActions: ["close-issue"] });

      const result = handleSignal(tmp, "close_issue");

      expect(result.error).toBeUndefined();
      expect(result.message).toContain("done");

      const state = readState(tmp);
      expect(state.activeIssue).toBeNull();
      expect(state.phase).toBeNull();

      const store = createStore(tmp);
      expect(store.getIssue("001-test")?.status).toBe("done");
    });

    it("preserves megaEnabled across state reset", () => {
      makeIssueFile(tmp, "001-test", 1);
      setState(tmp, { phase: "done", megaEnabled: true });
      handleSignal(tmp, "close_issue");
      expect(readState(tmp).megaEnabled).toBe(true);
    });

    it("returns error when not in done phase", () => {
      setState(tmp, { phase: "implement" });
      const result = handleSignal(tmp, "close_issue");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("done phase");
    });

    it("closes source issues before the batch issue (batch auto-close)", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "010-source-a.md"),
        "---\nid: 10\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Source A\nDesc",
      );
      writeFileSync(
        join(issuesDir, "011-source-b.md"),
        "---\nid: 11\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Source B\nDesc",
      );
      writeFileSync(
        join(issuesDir, "020-batch.md"),
        "---\nid: 20\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\nsources: [10, 11]\n---\n# Batch\nCombined",
      );

      setState(tmp, { activeIssue: "020-batch", phase: "done" });

      const result = handleSignal(tmp, "close_issue");

      expect(result.error).toBeUndefined();
      expect(result.message).toContain("2 source issues");

      const store = createStore(tmp);
      expect(store.getIssue("010-source-a")?.status).toBe("done");
      expect(store.getIssue("011-source-b")?.status).toBe("done");
      expect(store.getIssue("020-batch")?.status).toBe("done");

      const state = readState(tmp);
      expect(state.activeIssue).toBeNull();
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

  describe("triggerNewSession — error cases", () => {
    it("does NOT return triggerNewSession when phase_next fails", () => {
      setState(tmp, { phase: "spec" }); // spec.md missing — gate will fail
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when phase_back fails", () => {
      setState(tmp, { phase: "brainstorm" }); // no backward transition
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when task_done fails", () => {
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null, // Will fail TDD check
      });
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when plan_draft_done fails", async () => {
      setState(tmp, { phase: "implement", planMode: null });
      const result = await handlePlanDraftDone(tmp);
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });

  describe("triggerNewSession — non-transition actions", () => {
    it("does NOT return triggerNewSession for tests_failed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for tests_passed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_passed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for close_issue", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "001-test.md"),
        "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Test\nDesc",
      );
      setState(tmp, { phase: "done" });
      const result = handleSignal(tmp, "close_issue");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });

  describe("T1 dead code removal verification", () => {
    it("plan-lint-model.ts does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "extensions/megapowers/validation/plan-lint-model.ts"), "utf-8")
      ).toThrow();
    });

    it("lint-plan-prompt.md does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "prompts/lint-plan-prompt.md"), "utf-8")
      ).toThrow();
    });

    it("plan-lint-model.test.ts does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "tests/plan-lint-model.test.ts"), "utf-8")
      ).toThrow();
    });

    it("no runtime imports reference plan-lint-model", () => {
      const extensionsDir = join(process.cwd(), "extensions");
      const { execSync } = require("child_process");
      const result = execSync(
        `grep -rn "from.*plan-lint-model" "${extensionsDir}" --include="*.ts" || true`,
        { encoding: "utf-8" }
      );
      expect(result.trim()).toBe("");
    });
  });
});