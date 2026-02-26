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

  it("has 8 phases in correct order", () => {
    const phaseNames = featureWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "done"]);
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

  it("has plan → review transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "review");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has plan → implement transition with requireArtifact gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "plan" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireArtifact", file: "plan.md" }]);
  });

  it("has review → implement transition with requireReviewApproved gate", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "review" && t.to === "implement");
    expect(t).toBeDefined();
    expect(t!.gates).toEqual([{ type: "requireReviewApproved" }]);
  });

  it("has review → plan as backward transition", () => {
    const t = featureWorkflow.transitions.find(t => t.from === "review" && t.to === "plan");
    expect(t).toBeDefined();
    expect(t!.backward).toBe(true);
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
    expect(blockingPhases).toEqual(expect.arrayContaining(["brainstorm", "spec", "plan", "review", "verify", "done"]));
  });

  it("marks review phase with needsReviewApproval", () => {
    const p = featureWorkflow.phases.find(p => p.name === "review");
    expect(p!.needsReviewApproval).toBe(true);
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

  it("has 7 phases in correct order", () => {
    const phaseNames = bugfixWorkflow.phases.map(p => p.name);
    expect(phaseNames).toEqual(["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"]);
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

  it("has review → implement transition with requireReviewApproved gate", () => {
    const transitions = bugfixWorkflow.transitions.filter(t => t.from === "review");
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe("implement");
    expect(transitions[0].gates).toEqual([{ type: "requireReviewApproved" }]);
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

  it("marks review phase with needsReviewApproval", () => {
    const p = bugfixWorkflow.phases.find(p => p.name === "review");
    expect(p!.needsReviewApproval).toBe(true);
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

  it("marks plan, review, verify, done as blocking", () => {
    const blockingPhases = bugfixWorkflow.phases.filter(p => p.blocking).map(p => p.name);
    expect(blockingPhases).toEqual(expect.arrayContaining(["plan", "review", "verify", "done"]));
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
  it("returns save_artifact + phase_next for phase with artifact (spec)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "spec")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"spec"');
    expect(instructions).toContain("phase_next");
  });

  it("derives save phase name from artifact filename base, not phase name", () => {
    const phase = bugfixWorkflow.phases.find(p => p.name === "diagnose")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"diagnosis"');
    expect(instructions).not.toContain('"diagnose"');
  });

  it("returns TDD instructions for implement phase (tdd, no artifact)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "implement")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("task_done");
    expect(instructions).toContain("test");
  });

  it("returns review_approve for review phase (needsReviewApproval)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "review")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("review_approve");
  });

  it("returns save_artifact + phase_next for brainstorm (has artifact, open-ended)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "brainstorm")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"brainstorm"');
    expect(instructions).toContain("phase_next");
  });

  it("returns save_artifact guidance for terminal phase (done)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "done")!;
    const instructions = deriveToolInstructions(phase, { isTerminal: true });
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).not.toContain("phase_next");
  });

  it("returns save_artifact + phase_next for reproduce phase (has artifact)", () => {
    const phase = bugfixWorkflow.phases.find(p => p.name === "reproduce")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"reproduce"');
    expect(instructions).toContain("phase_next");
  });

  it("returns save_artifact + phase_next for code-review phase (artifact + tdd)", () => {
    const phase = featureWorkflow.phases.find(p => p.name === "code-review")!;
    const instructions = deriveToolInstructions(phase);
    expect(instructions).toContain("megapowers_save_artifact");
    expect(instructions).toContain('"code-review"');
    expect(instructions).toContain("phase_next");
  });
});
