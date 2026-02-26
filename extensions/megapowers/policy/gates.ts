import type { MegapowersState, Phase } from "../state/state-machine.js";
import type { Store } from "../state/store.js";
import { hasOpenQuestions } from "../spec-parser.js";
import { deriveTasks } from "../state/derived.js";

export interface GateResult {
  pass: boolean;
  reason?: string;
}

const BACKWARD_TARGETS = new Set<string>([
  "review→plan",
  "verify→implement",
  "code-review→implement",
]);

function isBackward(from: Phase, to: Phase): boolean {
  return BACKWARD_TARGETS.has(`${from}→${to}`);
}

export function checkGate(state: MegapowersState, target: Phase, store: Store, cwd?: string): GateResult {
  const from = state.phase;
  if (!from || !state.activeIssue) {
    return { pass: false, reason: "No active phase or issue" };
  }

  if (isBackward(from, target)) {
    return { pass: true };
  }

  switch (`${from}→${target}`) {
    case "brainstorm→spec":
      return { pass: true };

    case "spec→plan": {
      if (!store.planFileExists(state.activeIssue, "spec.md")) {
        return { pass: false, reason: "spec.md not found. The LLM needs to produce a spec first." };
      }
      const spec = store.readPlanFile(state.activeIssue, "spec.md");
      if (spec && hasOpenQuestions(spec)) {
        return { pass: false, reason: "Spec has unresolved open questions. Resolve them before advancing." };
      }
      return { pass: true };
    }

    case "plan→review":
    case "plan→implement": {
      if (!store.planFileExists(state.activeIssue, "plan.md")) {
        return { pass: false, reason: "plan.md not found. The LLM needs to produce a plan first." };
      }
      return { pass: true };
    }

    case "review→implement": {
      if (!state.reviewApproved) {
        return { pass: false, reason: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }

    case "implement→verify": {
      const tasks = (state.activeIssue && cwd) ? deriveTasks(cwd, state.activeIssue) : [];
      if (tasks.length === 0) {
        return { pass: false, reason: "No plan tasks found. Was the plan parsed correctly?" };
      }
      const completedSet = new Set(state.completedTasks);
      const incomplete = tasks.filter(t => !completedSet.has(t.index));
      if (incomplete.length > 0) {
        return {
          pass: false,
          reason: `${incomplete.length} of ${tasks.length} tasks still incomplete.`,
        };
      }
      return { pass: true };
    }

    case "verify→code-review": {
      if (!store.planFileExists(state.activeIssue, "verify.md")) {
        return { pass: false, reason: "verify.md not found. Run verification first." };
      }
      return { pass: true };
    }

    case "code-review→done": {
      if (!store.planFileExists(state.activeIssue, "code-review.md")) {
        return { pass: false, reason: "code-review.md not found. Run code review first." };
      }
      return { pass: true };
    }

    case "reproduce→diagnose": {
      if (!store.planFileExists(state.activeIssue, "reproduce.md")) {
        return { pass: false, reason: "reproduce.md not found. Document the bug reproduction first." };
      }
      return { pass: true };
    }

    case "diagnose→plan": {
      if (!store.planFileExists(state.activeIssue, "diagnosis.md")) {
        return { pass: false, reason: "diagnosis.md not found. Complete the diagnosis first." };
      }
      return { pass: true };
    }

    default:
      return { pass: true };
  }
}
