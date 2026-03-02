// tests/workflow-configs.test.ts
import { describe, it, expect } from "bun:test";
import { featureWorkflow } from "../extensions/megapowers/workflows/feature.js";
import { bugfixWorkflow } from "../extensions/megapowers/workflows/bugfix.js";
import { getWorkflowConfig, validateWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";
import type { WorkflowConfig } from "../extensions/megapowers/workflows/types.js";
import { deriveToolInstructions, type DeriveOptions } from "../extensions/megapowers/workflows/tool-instructions.js";

describe("feature workflow config", () => {
  it("has name 'feature'", () => {
    expect(featureWorkflow.name).toBe("feature");
  });

  it("has 7 phases in correct order", () => {
    const phaseNames = featureWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["brainstorm", "spec", "plan", "implement", "verify", "code-review", "done"]);
  });

  it("has brainstorm → spec transition with alwaysPass gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "brainstorm" && t.to === "spec");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "alwaysPass" }]);
  });

  it("has spec → plan transition with requireArtifact and noOpenQuestions gates", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "spec" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([
      { type: "requireArtifact", file: "spec.md" },
      { type: "noOpenQuestions", file: "spec.md" },
    ]);
  });


  it("has plan → implement transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has no transitions referencing review phase", () => {
    const reviewTransitions = featureWorkflow.transitions.filter(
      t => t.from === "review" || t.to === "review",
    );
    expect(reviewTransitions).toEqual([]);
  });

  it("has no review entry in phases array", () => {
    const hasReview = featureWorkflow.phases.some(p => p.name === "review");
    expect(hasReview).toBe(false);
  });



  it("has implement → verify transition with allTasksComplete gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "implement" && t.to === "verify");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "allTasksComplete" }]);
  });

  it("has verify → code-review transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "verify" && t.to === "code-review");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "verify.md" }]);
  });

  it("has verify → implement as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "verify" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("has code-review → done transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "code-review" && t.to === "done");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "code-review.md" }]);
  });

  it("has code-review → implement as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "code-review" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("marks brainstorm as open-ended", () => {
    const p = featureWorkflow.phases.find(p => p.name === "brainstorm");
    expect(p!.openEnded).toBe(true);
  });

  it("marks implement as TDD phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "implement");
    expect(p!.tdd).toBe(true);
  });

  it("marks code-review as TDD phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "code-review");
    expect(p!.tdd).toBe(true);
  });

  it("marks blocking phases correctly", () => {
    const blockingPhases = featureWorkflow.phases.filter(p => p.blocking).map(p => p.name);
    expect(blockingPhases).toEqual(expect.arrayContaining(["brainstorm", "spec", "plan", "verify", "done"]));
  });


  it("declares artifact on brainstorm phase", () => {
    const p = featureWorkflow.phases.find(p => p.name === "brainstorm");
    expect(p!.artifact).toBe("brainstorm.md");
  });

  it("has no phaseAliases", () => {
    expect(featureWorkflow.phaseAliases).toBeUndefined();
  });
});

describe("bugfix workflow config", () => {
  it("has name 'bugfix'", () => {
    expect(bugfixWorkflow.name).toBe("bugfix");
  });

  it("has 6 phases in correct order", () => {
    const phaseNames = bugfixWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["reproduce", "diagnose", "plan", "implement", "verify", "done"]);
  });

  it("has reproduce → diagnose transition with requireArtifact gate for reproduce.md", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "reproduce" && t.to === "diagnose");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "reproduce.md" }]);
  });

  it("has diagnose → plan transition with requireArtifact gate for diagnosis.md", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "diagnose" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "diagnosis.md" }]);
  });

  it("has no transitions referencing review phase", () => {
    const reviewTransitions = bugfixWorkflow.transitions.filter(
      t => t.from === "review" || t.to === "review",
    );
    expect(reviewTransitions).toEqual([]);
  });



  it("has verify → implement as backward transition", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "verify" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
  });

  it("has verify → done transition with alwaysPass", () => {
    const t = bugfixWorkflow.transitions.find(t => t.from === "verify" && t.to === "done");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "alwaysPass" }]);
  });

  it("has phaseAliases mapping reproduce→brainstorm and diagnosis→spec", () => {
    expect(bugfixWorkflow.phaseAliases).toEqual({
      reproduce: "brainstorm",
      diagnosis: "spec",
    });
  });

  it("marks reproduce and diagnose as open-ended", () => {
    const openEnded = bugfixWorkflow.phases.filter(p => p.openEnded).map(p => p.name);
    expect(openEnded).toContain("reproduce");
    expect(openEnded).toContain("diagnose");
  });


  it("declares artifact on reproduce phase", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "reproduce");
    expect(p!.artifact).toBe("reproduce.md");
  });

  it("declares artifact on diagnose phase", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "diagnose");
    expect(p!.artifact).toBe("diagnosis.md");
  });

  it("does NOT mark reproduce or diagnose as blocking (preserves current behavior)", () => {
    const reproduce = bugfixWorkflow.phases.find(p => p.name === "reproduce");
    const diagnose = bugfixWorkflow.phases.find(p => p.name === "diagnose");
    expect(reproduce!.blocking).toBeFalsy();
    expect(diagnose!.blocking).toBeFalsy();
  });

  it("marks plan, verify, done as blocking", () => {
    const blockingPhases = bugfixWorkflow.phases.filter(p => p.blocking).map(p => p.name);
    expect(blockingPhases).toEqual(expect.arrayContaining(["plan", "verify", "done"]));
    expect(blockingPhases).not.toContain("reproduce");
    expect(blockingPhases).not.toContain("diagnose");
  });
});

describe("workflow registry", () => {
  it("returns feature config for 'feature'", () => {
    const config = getWorkflowConfig("feature");
    expect(config.name).toBe("feature");
  });

  it("returns bugfix config for 'bugfix'", () => {
    const config = getWorkflowConfig("bugfix");
    expect(config.name).toBe("bugfix");
  });

  it("throws for unknown workflow name", () => {
    expect(() => getWorkflowConfig("unknown" as any)).toThrow("Unknown workflow");
  });
});

describe("workflow config validation", () => {
  it("rejects config with transition 'to' referencing unknown phase", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }],
      transitions: [{ from: "brainstorm", to: "nonexistent" as any, gates: [] }],
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("nonexistent");
  });

  it("rejects config with transition 'from' referencing unknown phase", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }],
      transitions: [{ from: "nonexistent" as any, to: "spec", gates: [] }],
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("nonexistent");
  });

  it("rejects config where non-terminal phase has no outgoing transition", () => {
    const bad: WorkflowConfig = {
      name: "feature",
      phases: [{ name: "brainstorm" }, { name: "spec" }, { name: "done" }],
      transitions: [{ from: "brainstorm", to: "spec", gates: [] }],
    };
    expect(() => validateWorkflowConfig(bad)).toThrow("spec");
  });

  it("accepts valid feature config", () => {
    expect(() => validateWorkflowConfig(featureWorkflow)).not.toThrow();
  });

  it("accepts valid bugfix config", () => {
    expect(() => validateWorkflowConfig(bugfixWorkflow)).not.toThrow();
  });
});

describe("full regression verification (Task 16)", () => {
  it("all workflow configs are validated at import time", () => {
    // This test verifies that the registry module loads without throwing,
    // meaning all configs pass validation at registration time (AC16)
    expect(getWorkflowConfig("feature").name).toBe("feature");
    expect(getWorkflowConfig("bugfix").name).toBe("bugfix");
  });
});

describe("deriveToolInstructions", () => {
  it("returns write + concrete artifact path + phase_next for phases with artifacts (spec) (AC5/AC7)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "spec")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/spec.md");
    expect(instructions).toContain("phase_next");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });

  it("derives artifact path from artifact filename, not phase name (diagnose → diagnosis.md)", () => {
    const phase = bugfixWorkflow.phases.find(p => p.name === "diagnose")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/diagnosis.md");
    expect(instructions).not.toContain(".megapowers/plans/001-test/diagnose.md");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });
  it("returns TDD instructions for implement phase (tdd, no artifact)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "implement")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("task_done");
    expect(instructions).toContain("test");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });
  it("feature workflow has no review phase (no review_approve path)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "review");
    expect(phase).toBeUndefined();
  });

  it("returns write + path + phase_next for brainstorm (has artifact, open-ended)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "brainstorm")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/brainstorm.md");
    expect(instructions).toContain("phase_next");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });

  it("returns write guidance for terminal phase (done) with no phase_next (AC6)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "done")!;
    const instructions = deriveToolInstructions(phase, "001-test", { isTerminal: true });
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/");
    expect(instructions).not.toContain("phase_next");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });

  it("returns write + path + phase_next for reproduce phase (has artifact)", () => {
    const phase = bugfixWorkflow.phases.find(p => p.name === "reproduce")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/reproduce.md");
    expect(instructions).toContain("phase_next");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });

  it("returns write + path + phase_next for code-review phase (artifact + tdd)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "code-review")!;
    const instructions = deriveToolInstructions(phase, "001-test");
    expect(instructions).toContain("write");
    expect(instructions).toContain(".megapowers/plans/001-test/code-review.md");
    expect(instructions).toContain("phase_next");
    expect(instructions).not.toContain("megapowers_save_artifact");
  });
});
