import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { advancePhase } from "../extensions/megapowers/policy/phase-advance.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { featureWorkflow } from "../extensions/megapowers/workflows/feature.js";
import { writePlanTask } from "../extensions/megapowers/state/plan-store.js";

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

  function writeTask(issue: string, id: number, title: string) {
    writePlanTask(
      tmp,
      issue,
      {
        id,
        title,
        status: "approved",
        depends_on: [],
        no_test: false,
        files_to_modify: [],
        files_to_create: [],
      },
      `${title} body`,
    );
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

  it("advances plan→implement and sets currentTaskIndex to 0 when no tasks completed", () => {
    setState({ phase: "plan" });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeTask("001-test", 1, "A");
    writeTask("001-test", 2, "B");
    writeTask("001-test", 3, "C");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
    expect(readState(tmp).currentTaskIndex).toBe(0);
  });

  it("sets currentTaskIndex to first incomplete when some tasks done", () => {
    setState({ phase: "plan", completedTasks: [1] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeTask("001-test", 1, "A");
    writeTask("001-test", 2, "B");
    writeTask("001-test", 3, "C");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Task 1 (index=1) is completed, so first incomplete is tasks[1] which is Task 2
    expect(readState(tmp).currentTaskIndex).toBe(1);
  });

  it("sets currentTaskIndex to first incomplete when middle task is done", () => {
    setState({ phase: "plan", completedTasks: [2] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeTask("001-test", 1, "A");
    writeTask("001-test", 2, "B");
    writeTask("001-test", 3, "C");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Task 2 is done but Task 1 is not — first incomplete is index 0
    expect(readState(tmp).currentTaskIndex).toBe(0);
  });

  it("sets currentTaskIndex to first incomplete when first two tasks done", () => {
    setState({ phase: "plan", completedTasks: [1, 2] });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n\n### Task 3: C\n");
    writeTask("001-test", 1, "A");
    writeTask("001-test", 2, "B");
    writeTask("001-test", 3, "C");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    // Tasks 1 and 2 done, first incomplete is tasks[2] = Task 3
    expect(readState(tmp).currentTaskIndex).toBe(2);
  });

  it("resets reviewApproved when advancing spec→plan", () => {
    setState({ phase: "spec", reviewApproved: true });
    writeArtifact("001-test", "spec.md", "# Spec\n\n## Acceptance Criteria\n1. Works\n\n## Open Questions\nNone\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(readState(tmp).reviewApproved).toBe(false);
  });

  it("advances to specific target when provided", () => {
    setState({ phase: "plan" });
    writeArtifact("001-test", "plan.md", "# Plan\n");
    writeTask("001-test", 1, "A");
    const result = advancePhase(tmp, "implement");
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
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

  describe("phase_next default target skips backward transitions (AC7)", () => {
    it("from verify, default target is code-review (skips backward implement)", () => {
      const originalTransitions = [...featureWorkflow.transitions];
      try {
        const reorderedVerify = originalTransitions
          .filter((t) => t.from === "verify")
          .sort((a, b) => Number(Boolean(b.backward)) - Number(Boolean(a.backward)));
        featureWorkflow.transitions = [
          ...originalTransitions.filter((t) => t.from !== "verify"),
          ...reorderedVerify,
        ];

        setState({ phase: "verify" });
        writeArtifact("001-test", "verify.md", "# Verify\nAll passing\n");
        const result = advancePhase(tmp);
        expect(result.ok).toBe(true);
        expect(result.newPhase).toBe("code-review");
      } finally {
        featureWorkflow.transitions = originalTransitions;
      }
    });

    it("from code-review, default target is done (skips backward implement)", () => {
      setState({ phase: "code-review" });
      writeArtifact("001-test", "code-review.md", "# Code Review\nApproved\n");
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("done");
    });

    it("from plan, default target is implement", () => {
      setState({ phase: "plan" });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      writeTask("001-test", 1, "A");
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("implement");
    });

    it("explicit backward target still works when specified (AC7 — explicit override)", () => {
      setState({ phase: "verify" });
      const result = advancePhase(tmp, "implement");
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("implement");
    });
  });

  describe("phase_next preserves existing gate behavior (AC8)", () => {
    it("brainstorm → spec still works", () => {
      setState({ phase: "brainstorm" });
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("spec");
    });

    it("spec → plan gate still rejects without spec.md", () => {
      setState({ phase: "spec" });
      const result = advancePhase(tmp);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("spec.md");
    });

    it("plan → implement gate still rejects without task files", () => {
      setState({ phase: "plan" });
      const result = advancePhase(tmp);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("task files");
    });
  });

  it("AC8: phase-advance has no jj import or jj parameter", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/policy/phase-advance.ts"), "utf-8");
    expect(source).not.toContain("from \"../jj.js\"");
    expect(source).not.toMatch(/advancePhase\([^)]*jj\??/);
  });

  it("AC8: advancePhase can still advance spec → plan without jj", () => {
    writeArtifact("001-test", "spec.md", "# Spec\n\nNo open questions.\n");
    setState({
      activeIssue: "001-test",
      workflow: "feature",
      phase: "spec",
    });

    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("plan");
  });
});
