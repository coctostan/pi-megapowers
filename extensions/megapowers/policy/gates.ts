// extensions/megapowers/policy/gates.ts
import type { MegapowersState, Phase } from "../state/state-machine.js";
import type { Store } from "../state/store.js";
import { getWorkflowConfig } from "../workflows/registry.js";
import { evaluateGate } from "../workflows/gate-evaluator.js";

export interface GateResult {
  pass: boolean;
  reason?: string;
}

export function checkGate(state: MegapowersState, target: Phase, store: Store, cwd?: string): GateResult {
  const from = state.phase;
  if (!from || !state.activeIssue || !state.workflow) {
    return { pass: false, reason: "No active phase or issue" };
  }

  const config = getWorkflowConfig(state.workflow);
  const transition = config.transitions.find(t => t.from === from && t.to === target);

  if (!transition) {
    // No transition defined — allow by default (matches previous default case behavior)
    return { pass: true };
  }

  // Backward transitions skip gates
  if (transition.backward) {
    return { pass: true };
  }

  // Evaluate all gates — first failure stops
  for (const gate of transition.gates) {
    const result = evaluateGate(gate, state, store, cwd);
    if (!result.pass) {
      return { pass: false, reason: result.message };
    }
  }

  return { pass: true };
}
