import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advancePhase } from "../extensions/megapowers/policy/phase-advance.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import type { JJ } from "../extensions/megapowers/jj.js";

describe("advancePhase", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "phase-advance-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeArtifact(issue: string, filename: string, content: string) {
    const dir = join(tmp, ".megapowers", "plans", issue);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), content);
  }

  function setState(overrides: Partial<MegapowersState>) {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", ...overrides });
  }

  it("advances brainstorm→spec", () => {
    setState({ phase: "brainstorm" });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("spec");
    expect(readState(tmp).phase).toBe("spec");
  });

  it("advances spec→plan when spec exists and no open questions", () => {
    setState({ phase: "spec" });
    writeArtifact("001-test", "spec.md", "# Spec\n\n## Open Questions\nNone\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("plan");
  });

  it("rejects spec→plan when gate fails (spec.md missing)", () => {
    setState({ phase: "spec" });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("spec.md");
  });

  it("advances to implement and sets currentTaskIndex to 0 when no tasks completed", () => {
    setState({ phase: "review", reviewApproved: true });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
    expect(readState(tmp).currentTaskIndex).toBe(0);
  });

  it("sets currentTaskIndex to first incomplete when some tasks done", () => {
    setState({ phase: "review", reviewApproved: true, completedTasks: [1] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Task 1 (index=1) is completed, so first incomplete is tasks[1] which is Task 2
    expect(readState(tmp).currentTaskIndex).toBe(1);
  });

  it("sets currentTaskIndex to first incomplete when middle task is done", () => {
    setState({ phase: "review", reviewApproved: true, completedTasks: [2] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Task 2 is done but Task 1 is not — first incomplete is index 0
    expect(readState(tmp).currentTaskIndex).toBe(0);
  });

  it("sets currentTaskIndex to first incomplete when first two tasks done", () => {
    setState({ phase: "review", reviewApproved: true, completedTasks: [1, 2] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Tasks 1 and 2 done, first incomplete is tasks[2] = Task 3
    expect(readState(tmp).currentTaskIndex).toBe(2);
  });

  it("resets reviewApproved when advancing to plan (backward)", () => {
    setState({ phase: "review", reviewApproved: true });
    const result = advancePhase(tmp, "plan");
    expect(result.ok).toBe(true);
    expect(readState(tmp).reviewApproved).toBe(false);
  });

  it("advances to specific target when provided", () => {
    setState({ phase: "plan" });
    writeArtifact("001-test", "plan.md", "# Plan\n");
    const result = advancePhase(tmp, "review");
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("review");
  });

  it("rejects when no active issue", () => {
    writeState(tmp, createInitialState());
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid transition", () => {
    setState({ phase: "brainstorm" });
    const result = advancePhase(tmp, "implement");
    expect(result.ok).toBe(false);
  });

  it("persists phase change to state.json", () => {
    setState({ phase: "brainstorm" });
    advancePhase(tmp);
    expect(readState(tmp).phase).toBe("spec");
  });

  it("records phase history entry", () => {
    setState({ phase: "brainstorm" });
    advancePhase(tmp);
    const state = readState(tmp);
    expect(state.phaseHistory).toHaveLength(1);
    expect(state.phaseHistory[0].from).toBe("brainstorm");
    expect(state.phaseHistory[0].to).toBe("spec");
  });

  describe("jj integration", () => {
    function mockJJ(opts: { isJJ?: boolean; newChangeId?: string } = {}): JJ {
      const { isJJ = true, newChangeId = "mock-change-id" } = opts;
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
        diff: async () => "",
        abandon: async () => {},
        squashInto: async () => {},
      };
    }

    it("returns ok when jj is provided and advancing to implement (AC19)", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj = mockJJ();
      const result = advancePhase(tmp, undefined, jj);
      expect(result.ok).toBe(true);
    });

    it("squashes task changes when advancing to done (AC21)", async () => {
      setState({ phase: "code-review", jjChangeId: "issue-change" });
      writeArtifact("001-test", "code-review.md", "# Review\n");
      let squashedInto: string | null = null;
      const jj: JJ = {
        ...mockJJ(),
        squashInto: async (id: string) => { squashedInto = id; },
      };
      advancePhase(tmp, "done", jj);
      // Wait for async jj ops to complete
      await new Promise(r => setTimeout(r, 50));
      expect(squashedInto).toBe("issue-change");
    });

    it("does not fail when jj operations throw (non-fatal)", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj: JJ = {
        ...mockJJ(),
        newChange: async () => { throw new Error("jj broken"); },
        describe: async () => { throw new Error("jj broken"); },
      };
      const result = advancePhase(tmp, undefined, jj);
      expect(result.ok).toBe(true);
    });

    it("is a no-op when not a jj repo", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const jj = mockJJ({ isJJ: false });
      const result = advancePhase(tmp, undefined, jj);
      expect(result.ok).toBe(true);
    });
  });
});
