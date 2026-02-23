// extensions/megapowers/phase-advance.ts
import { readState, writeState } from "./state-io.js";
import { getValidTransitions, transition, type Phase } from "./state-machine.js";
import { checkGate } from "./gates.js";
import { createStore } from "./store.js";
import { deriveTasks } from "./derived.js";
import { formatChangeDescription, type JJ } from "./jj.js";

export interface AdvanceResult {
  ok: boolean;
  newPhase?: Phase;
  error?: string;
}

export function advancePhase(cwd: string, targetPhase?: Phase, jj?: JJ): AdvanceResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { ok: false, error: "No active issue or phase." };
  }

  const validNext = getValidTransitions(state.workflow, state.phase);
  if (validNext.length === 0) {
    return { ok: false, error: `No valid transitions from ${state.phase}.` };
  }

  const target = targetPhase ?? validNext[0];
  if (!validNext.includes(target)) {
    return {
      ok: false,
      error: `Cannot transition from ${state.phase} to ${target} in ${state.workflow} workflow.`,
    };
  }

  // Gate check — use store for existing checkGate compatibility
  const store = createStore(cwd);
  const gate = checkGate(state, target, store);
  if (!gate.pass) {
    return { ok: false, error: gate.reason };
  }

  // Pass tasks when advancing to implement so currentTaskIndex is set correctly
  const tasks = target === "implement" ? deriveTasks(cwd, state.activeIssue) : undefined;
  const newState = transition(state, target, tasks);

  writeState(cwd, newState);

  // jj operations: async, non-fatal, fire-and-forget
  if (jj) {
    const issueSlug = state.activeIssue;
    const fromPhase = state.phase;
    const savedJJChangeId = state.jjChangeId;

    (async () => {
      try {
        if (!await jj.isJJRepo()) return;

        await jj.describe(formatChangeDescription(issueSlug, fromPhase, "complete"));

        const changeId = await jj.newChange(formatChangeDescription(issueSlug, target));
        if (changeId) {
          const s = readState(cwd);
          writeState(cwd, { ...s, jjChangeId: changeId });
        }

        // Squash task changes into parent when advancing to done (AC21)
        if (target === "done" && savedJJChangeId) {
          try {
            await jj.squashInto(savedJJChangeId);
          } catch {
            // Non-fatal
          }
        }
      } catch {
        // jj failures are always non-fatal
      }
    })();
  }

  return { ok: true, newPhase: target };
}
