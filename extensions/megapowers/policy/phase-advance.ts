// extensions/megapowers/policy/phase-advance.ts
import { readState, writeState } from "../state/state-io.js";
import { getValidTransitions, transition, type Phase } from "../state/state-machine.js";
import { checkGate } from "./gates.js";
import { createStore } from "../state/store.js";
import { deriveTasks } from "../state/derived.js";
import { getWorkflowConfig } from "../workflows/registry.js";

export interface AdvanceResult {
  ok: boolean;
  newPhase?: Phase;
  error?: string;
}

export function advancePhase(cwd: string, targetPhase?: Phase): AdvanceResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { ok: false, error: "No active issue or phase." };
  }

  const validNext = getValidTransitions(state.workflow, state.phase);
  if (validNext.length === 0) {
    return { ok: false, error: `No valid transitions from ${state.phase}.` };
  }

  let target: Phase;
  if (targetPhase) {
    target = targetPhase;
  } else {
    // AC7: default picks first NON-backward transition
    const config = getWorkflowConfig(state.workflow);
    const forwardTransition = config.transitions.find(
      (t) => t.from === state.phase && !t.backward,
    );
    target = forwardTransition?.to ?? validNext[0];
  }

  if (!validNext.includes(target)) {
    return {
      ok: false,
      error: `Cannot transition from ${state.phase} to ${target} in ${state.workflow} workflow.`,
    };
  }

  // Gate check — use store for existing checkGate compatibility
  const store = createStore(cwd);
  const gate = checkGate(state, target, store, cwd);
  if (!gate.pass) {
    return { ok: false, error: gate.reason };
  }

  // Pass tasks when advancing to implement so currentTaskIndex is set correctly
  const tasks = target === "implement" ? deriveTasks(cwd, state.activeIssue) : undefined;
  const newState = transition(state, target, tasks);

  writeState(cwd, newState);


  return { ok: true, newPhase: target };
}
