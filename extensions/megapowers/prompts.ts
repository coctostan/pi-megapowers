import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase, PlanTask, AcceptanceCriterion } from "./state-machine.js";

// --- Prompt file mapping ---

export const PHASE_PROMPT_MAP: Record<Phase, string> = {
  brainstorm: "brainstorm.md",
  spec: "write-spec.md",
  plan: "write-plan.md",
  review: "review-plan.md",
  implement: "implement-task.md",
  verify: "verify.md",
  "code-review": "code-review.md",
  done: "generate-docs.md",
  reproduce: "diagnose-bug.md",
  diagnose: "diagnose-bug.md",
};

// --- Template loading ---

function getPromptsDir(): string {
  // Resolve relative to this file's location: extensions/megapowers/prompts.ts → ../../prompts/
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "..", "..", "prompts");
}

export function loadPromptFile(filename: string): string {
  try {
    return readFileSync(join(getPromptsDir(), filename), "utf-8");
  } catch {
    return "";
  }
}

export const BRAINSTORM_PLAN_PHASES: Phase[] = ["brainstorm", "plan"];

export function getPhasePromptTemplate(phase: Phase): string {
  const filename = PHASE_PROMPT_MAP[phase];
  if (!filename) return "";
  return loadPromptFile(filename);
}

// --- Interpolation ---

export function interpolatePrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

// --- High-level: build prompt for a phase ---

export function buildPhasePrompt(
  phase: Phase,
  vars: Record<string, string>
): string {
  const template = getPhasePromptTemplate(phase);
  if (!template) return "";
  return interpolatePrompt(template, vars);
}

// --- Task implementation helpers ---

export function buildImplementTaskVars(
  tasks: PlanTask[],
  currentIndex: number
): Record<string, string> {
  const currentTask = tasks[currentIndex];
  const total = tasks.length;

  let previousSummaries: string;
  if (currentIndex === 0) {
    previousSummaries = "None — this is the first task.";
  } else {
    previousSummaries = tasks
      .slice(0, currentIndex)
      .map(t => {
        const status = t.completed ? "✓" : "○";
        return `${status} Task ${t.index}: ${t.description}`;
      })
      .join("\n");
  }

  return {
    current_task_index: String(currentTask?.index ?? currentIndex + 1),
    total_tasks: String(total),
    current_task_description: currentTask
      ? `Task ${currentTask.index}: ${currentTask.description}`
      : "No more tasks.",
    previous_task_summaries: previousSummaries,
  };
}

export function formatAcceptanceCriteriaList(criteria: AcceptanceCriterion[]): string {
  return criteria
    .map(c => `${c.id}. ${c.text} [${c.status}]`)
    .join("\n");
}
