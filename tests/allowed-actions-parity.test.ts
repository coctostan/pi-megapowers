import { describe, it, expect } from "bun:test";
import { getAllowedActions } from "../extensions/megapowers/workflows/allowed-actions.js";
import { deriveToolInstructions } from "../extensions/megapowers/workflows/tool-instructions.js";
import { getWorkflowConfig } from "../extensions/megapowers/workflows/registry.js";
import type { Phase, PlanMode } from "../extensions/megapowers/state/state-machine.js";

function extractSignalActions(text: string): Set<string> {
  const out = new Set<string>();
  // Match patterns like: action: "task_done"  /  action `"phase_next"`  /  action \"close_issue\"
  const re = /action[`"\\\s:]*"([a-z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return out;
}

function instructionFor(phase: Phase, planMode: PlanMode = null): string {
  const config = getWorkflowConfig("feature");
  const phaseConfig = config.phases.find(p => p.name === phase);
  if (!phaseConfig) return "";
  const isTerminal = config.phases[config.phases.length - 1].name === phase;
  return deriveToolInstructions(phaseConfig, "001-test", { isTerminal, planMode });
}

describe("allowed-actions ↔ deriveToolInstructions parity (AC25, AC58)", () => {
  const cases: Array<{ phase: Phase; planMode: PlanMode }> = [
    { phase: "implement", planMode: null },
    { phase: "verify", planMode: null },
    { phase: "code-review", planMode: null },
    { phase: "done", planMode: null },
  ];

  for (const { phase, planMode } of cases) {
    it(`derived instructions for ${phase} only mention actions that allowed-actions also lists`, () => {
      const allowed = new Set(getAllowedActions(phase, planMode).signalActions);
      const mentioned = extractSignalActions(instructionFor(phase));
      for (const a of mentioned) {
        expect(allowed.has(a)).toBe(true);
      }
    });
  }

  const planCases: Array<{ phase: Phase; planMode: PlanMode }> = [
    { phase: "plan", planMode: "draft" },
    { phase: "plan", planMode: "revise" },
    { phase: "plan", planMode: "review" },
  ];

  for (const { phase, planMode } of planCases) {
    it(`derived instructions for ${phase} (${planMode}) only mention actions that allowed-actions also lists`, () => {
      const allowed = new Set(getAllowedActions(phase, planMode).signalActions);
      const mentioned = extractSignalActions(instructionFor(phase, planMode));
      for (const a of mentioned) {
        expect(allowed.has(a)).toBe(true);
      }
    });
  }

  it("no allowed action set contains the deprecated review_approve", () => {
    for (const { phase, planMode } of [...cases, { phase: "plan" as Phase, planMode: "draft" as PlanMode }, { phase: "plan" as Phase, planMode: "review" as PlanMode }, { phase: "plan" as Phase, planMode: "revise" as PlanMode }]) {
      expect(getAllowedActions(phase, planMode).signalActions).not.toContain("review_approve");
    }
  });
});
