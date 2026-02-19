import type { MegapowersState, Phase, AcceptanceCriterion, PlanTask } from "./state-machine.js";
import { extractAcceptanceCriteria } from "./spec-parser.js";
import { extractPlanTasks } from "./plan-parser.js";

export interface Artifact {
  filename: string;
  content: string;
}

export interface AgentOutputResult {
  artifacts: Artifact[];
  stateUpdate: Partial<MegapowersState>;
  notifications: string[];
}

/**
 * Pure function: given LLM output text, current phase, and state,
 * determine what artifacts to save, state changes to make, and notifications to show.
 */
export function processAgentOutput(
  text: string,
  phase: Phase,
  state: MegapowersState
): AgentOutputResult {
  const artifacts: Artifact[] = [];
  const stateUpdate: Partial<MegapowersState> = {};
  const notifications: string[] = [];

  if (phase === "brainstorm" && text.length > 200) {
    if (/##\s+(Approach|Key Decisions)/i.test(text)) {
      artifacts.push({ filename: "brainstorm.md", content: text });
      notifications.push("Brainstorm summary saved.");
    }
  }

  if (phase === "spec" && text.length > 100) {
    artifacts.push({ filename: "spec.md", content: text });
    const criteria = extractAcceptanceCriteria(text);
    if (criteria.length > 0) {
      stateUpdate.acceptanceCriteria = criteria;
    }
    notifications.push(`Spec saved. ${criteria.length} acceptance criteria extracted.`);
  }

  if (phase === "plan" && text.length > 100) {
    artifacts.push({ filename: "plan.md", content: text });
    const tasks = extractPlanTasks(text);
    stateUpdate.planTasks = tasks;
    stateUpdate.currentTaskIndex = 0;
    notifications.push(`Plan saved. ${tasks.length} tasks extracted.`);
  }

  if (phase === "diagnose" && text.length > 100) {
    artifacts.push({ filename: "diagnosis.md", content: text });
    notifications.push("Diagnosis saved.");
  }

  if (phase === "review") {
    const passMatch = /\b(verdict|status)\b[:\s]*(pass|approved)/i.test(text);
    const reviseMatch = /\b(verdict|status)\b[:\s]*revise/i.test(text);
    if (passMatch && !reviseMatch) {
      stateUpdate.reviewApproved = true;
      notifications.push("Review: plan approved.");
    }
    if (text.length > 100) {
      artifacts.push({ filename: "review.md", content: text });
    }
  }

  if (phase === "implement") {
    const completionMatch = /(?:task\s+(?:complete|done|finished)|##?\s*(?:what was implemented|checkpoint))/i.test(text);
    if (completionMatch && state.currentTaskIndex < state.planTasks.length) {
      const tasks = [...state.planTasks.map(t => ({ ...t }))];
      tasks[state.currentTaskIndex] = { ...tasks[state.currentTaskIndex], completed: true };
      const nextIncomplete = tasks.findIndex((t, i) => i > state.currentTaskIndex && !t.completed);
      const nextIndex = nextIncomplete >= 0 ? nextIncomplete : state.currentTaskIndex + 1;
      stateUpdate.planTasks = tasks;
      stateUpdate.currentTaskIndex = nextIndex;
      const completed = tasks.filter(t => t.completed).length;
      notifications.push(`Task complete. ${completed}/${tasks.length} done.`);
    }
  }

  if (phase === "verify" && text.length > 100) {
    artifacts.push({ filename: "verify.md", content: text });
    if (state.acceptanceCriteria.length > 0) {
      const updatedCriteria = state.acceptanceCriteria.map(c => {
        const criterionPattern = new RegExp(
          `criterion\\s+${c.id}[\\s\\S]*?\\*{0,2}verdict\\*{0,2}:?\\*{0,2}\\s*(pass|fail|partial)`,
          "i"
        );
        const match = text.match(criterionPattern);
        if (match) {
          return { ...c, status: match[1].toLowerCase() as "pass" | "fail" | "partial" };
        }
        return c;
      });
      stateUpdate.acceptanceCriteria = updatedCriteria;
    }
    notifications.push("Verification report saved.");
  }

  if (phase === "code-review" && text.length > 100) {
    artifacts.push({ filename: "code-review.md", content: text });
    notifications.push("Code review saved.");
  }

  return { artifacts, stateUpdate, notifications };
}
