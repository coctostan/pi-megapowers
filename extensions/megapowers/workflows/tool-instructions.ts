// extensions/megapowers/workflows/tool-instructions.ts
import type { PhaseConfig } from "./types.js";
import type { Phase, PlanMode } from "../state/state-machine.js";
import { getAllowedActions } from "./allowed-actions.js";

export interface DeriveOptions {
  /** True if this is the last phase in the workflow (e.g. "done"). */
  isTerminal?: boolean;
  /** Current plan-loop mode, when deriving guidance for the plan phase. */
  planMode?: PlanMode;
}

function signalActionFor(phaseName: string, action: string, planMode: PlanMode = null): string {
  const allowed = getAllowedActions(phaseName as Phase, planMode).signalActions;
  if (!allowed.includes(action)) {
    throw new Error(`deriveToolInstructions drift: ${action} is not allowed for ${phaseName}${planMode ? ` (${planMode})` : ""}`);
  }
  return action;
}

export function deriveToolInstructions(
  phase: PhaseConfig,
  issueSlug: string,
  options?: DeriveOptions,
): string {
  const parts: string[] = [];
  const planDir = `.megapowers/plans/${issueSlug}`;

  if (phase.name === "plan" && options?.planMode) {
    const allowed = getAllowedActions("plan", options.planMode);
    if (allowed.planTask) {
      const planDraftDone = signalActionFor("plan", "plan_draft_done", options.planMode);
      parts.push(
        "Use `megapowers_plan_task(...)` to create or update structured plan tasks.",
        `When the tasks and plan artifacts are ready, call \`megapowers_signal\` with action \`"${planDraftDone}"\` to enter review mode.`,
      );
    } else if (allowed.planReview) {
      parts.push(
        'Submit the plan verdict with `megapowers_plan_review({ verdict: "approve", ... })` or `megapowers_plan_review({ verdict: "revise", ... })`.',
      );
    }
    return parts.join("\n");
  }
  // Terminal phase (done): save outputs but no phase_next
  if (options?.isTerminal) {
    parts.push(
      `Use \`write\` (or \`edit\`) to save done-phase outputs as files under \`${planDir}/\` (e.g. \`${planDir}/learnings.md\`).`,
    );
    return parts.join("\n");
  }
  // TDD phase without artifact: task-driven workflow (implement)
  if (phase.tdd && !phase.artifact) {
    const taskDone = signalActionFor(phase.name, "task_done");
    parts.push(
      `For each task: write tests first, run them (they must fail), then write implementation.`,
      `When a task is complete, call \`megapowers_signal\` with action \`"${taskDone}"\`.`,
      `The system will automatically advance to the next task or to verify when all tasks are done.`,
    );
    return parts.join("\n");
  }

  // Artifact phase: save then advance
  if (phase.artifact) {
    const artifactPath = `${planDir}/${phase.artifact}`;
    const phaseNext = signalActionFor(phase.name, "phase_next");
    parts.push(
      `When the ${phase.name} is complete, save the artifact by writing it to \`${artifactPath}\` using the \`write\` tool (or \`edit\` for incremental revisions).`,
      `Then call \`megapowers_signal\` with action \`"${phaseNext}"\` to advance.`,
    );
    return parts.join("\n");
  }
  // Default: just advance
  const phaseNext = signalActionFor(phase.name, "phase_next");
  parts.push(
    `When you have finished, call \`megapowers_signal\` with action \`"${phaseNext}"\` to advance.`,
  );
  return parts.join("\n");
}
