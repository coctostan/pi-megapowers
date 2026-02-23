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
  reproduce: "reproduce-bug.md",
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

/**
 * Check if all plan tasks are completed.
 */
export function allTasksComplete(tasks: PlanTask[]): boolean {
  return tasks.length > 0 && tasks.every(t => t.completed);
}

function buildRemainingTasksSummary(
  tasks: PlanTask[],
  currentIndex: number
): string {
  const remaining = tasks.filter((t, i) => i > currentIndex && !t.completed);
  if (remaining.length === 0) {
    return "None — this is the only remaining task.";
  }

  const completedIndices = new Set(
    tasks.filter(t => t.completed).map(t => t.index)
  );

  return remaining
    .map(t => {
      const deps = t.dependsOn ?? [];
      const unmetDeps = deps.filter(d => !completedIndices.has(d));
      if (unmetDeps.length > 0) {
        return `○ Task ${t.index}: ${t.description} [blocked — waiting on task(s) ${unmetDeps.join(", ")}]`;
      }
      return `○ Task ${t.index}: ${t.description} [ready — can be delegated to subagent]`;
    })
    .join("\n");
}

export function buildImplementTaskVars(
  tasks: PlanTask[],
  currentIndex: number
): Record<string, string> {
  const total = tasks.length;

  // All tasks done: provide clear summary instead of uninterpolated vars
  if (allTasksComplete(tasks)) {
    const summaries = tasks
      .map(t => `✓ Task ${t.index}: ${t.description}`)
      .join("\n");
    return {
      current_task_index: "—",
      total_tasks: String(total),
      current_task_description: "All tasks complete. Advance to verify phase.",
      previous_task_summaries: summaries,
      all_tasks_complete: "true",
      remaining_tasks: "None — all tasks complete.",
    };
  }

  const currentTask = tasks[currentIndex];

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
    all_tasks_complete: "false",
    remaining_tasks: buildRemainingTasksSummary(tasks, currentIndex),
  };
}

export function formatAcceptanceCriteriaList(criteria: AcceptanceCriterion[]): string {
  return criteria
    .map(c => `${c.id}. ${c.text} [${c.status}]`)
    .join("\n");
}
