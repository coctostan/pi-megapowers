// extensions/megapowers/workflows/gate-evaluator.ts
import type { GateConfig, GateEvalResult } from "./types.js";
import type { MegapowersState } from "../state/state-machine.js";
import type { Store } from "../state/store.js";
import { hasOpenQuestions } from "../spec-parser.js";
import { deriveTasks } from "../state/derived.js";
import { listPlanTasks } from "../state/plan-store.js";

export function evaluateGate(
  gate: GateConfig,
  state: MegapowersState,
  store: Store,
  cwd?: string,
): GateEvalResult {
  switch (gate.type) {
    case "requireArtifact": {
      if (!state.activeIssue) return { pass: false, message: "No active issue" };
      if (!store.planFileExists(state.activeIssue, gate.file)) {
        return { pass: false, message: `${gate.file} not found. The LLM needs to produce it first.` };
      }
      return { pass: true };
    }
    case "requireReviewApproved": {
      if (!state.reviewApproved) {
        return { pass: false, message: "Plan review not approved yet. The LLM needs to approve the plan." };
      }
      return { pass: true };
    }
    case "requirePlanApproved": {
      if (state.planMode !== null) {
        return { pass: false, message: `Plan review not complete (planMode: ${state.planMode}). Call plan_draft_done to submit for review.` };
      }
      return { pass: true };
    }
    case "noOpenQuestions": {
      if (!state.activeIssue) return { pass: true };
      const content = store.readPlanFile(state.activeIssue, gate.file);
      if (!content) return { pass: true };
      if (hasOpenQuestions(content)) {
        return { pass: false, message: "Spec has unresolved open questions. Resolve them before advancing." };
      }
      return { pass: true };
    }
    case "allTasksComplete": {
      if (!state.activeIssue || !cwd) return { pass: false, message: "No active issue or cwd" };
      const tasks = deriveTasks(cwd, state.activeIssue);
      if (tasks.length === 0) {
        return { pass: false, message: "No plan tasks found. Was the plan parsed correctly?" };
      }
      const completedSet = new Set(state.completedTasks);
      const incomplete = tasks.filter(t => !completedSet.has(t.index));
      if (incomplete.length > 0) {
        return { pass: false, message: `${incomplete.length} of ${tasks.length} tasks still incomplete.` };
      }
      return { pass: true };
    }
    case "requireTaskFiles": {
      if (!state.activeIssue || !cwd) return { pass: false, message: "No active issue or cwd" };
      const taskFiles = listPlanTasks(cwd, state.activeIssue);
      if (taskFiles.length === 0) {
        return { pass: false, message: `No task files found in .megapowers/plans/${state.activeIssue}/tasks/. Use megapowers_plan_task to create tasks before advancing.` };
      }
      return { pass: true };
    }
    case "alwaysPass":
      return { pass: true };
    case "custom":
      return gate.evaluate(state, store, cwd);
    default:
      throw new Error(`Unknown gate type: ${(gate as any).type}`);
  }
}
