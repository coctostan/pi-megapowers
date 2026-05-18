import { existsSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import type { Phase, PlanMode, TddState, TddTaskState, WorkflowType } from "./state/state-machine.js";
import type { Store } from "./state/store.js";
import { getWorkflowConfig } from "./workflows/registry.js";
import { deriveToolInstructions } from "./workflows/tool-instructions.js";
import { resolvePlanTemplate } from "./plan-orchestrator.js";
import { buildInjectedPrompt } from "./prompt-inject.js";

export interface ContextTaskProgress {
  current: number;
  total: number;
  completed: number;
  tddState: TddState | null;
}

export interface ContextArtifactsSummary {
  available: string[];
  missing: string[];
  count: number;
}

export interface ContextToolGuidanceSummary {
  active: string;
  reference: string;
  availabilityNote: string;
  instructionSummary: string;
}

export interface MegapowersContextSummary {
  megaEnabled: boolean;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  planMode: PlanMode;
  taskProgress: ContextTaskProgress | null;
  artifacts: ContextArtifactsSummary;
  toolGuidance: ContextToolGuidanceSummary;
}

const TASK_ORIENTED_PHASES = new Set<Phase>(["plan", "implement", "verify", "code-review", "done"]);

function planFileExists(cwd: string, issueSlug: string, filename: string, store?: Store): boolean {
  if (store?.planFileExists(issueSlug, filename)) return true;
  return existsSync(join(cwd, ".megapowers", "plans", issueSlug, filename));
}

function deriveArtifacts(cwd: string, issueSlug: string | null, workflow: WorkflowType | null, store?: Store): ContextArtifactsSummary {
  if (!issueSlug) return { available: [], missing: [], count: 0 };

  const names = new Set<string>(["plan.md"]);
  if (workflow) {
    for (const phase of getWorkflowConfig(workflow).phases) {
      if (phase.artifact) names.add(phase.artifact);
    }
  }

  const available: string[] = [];
  const missing: string[] = [];
  for (const filename of [...names].sort()) {
    if (planFileExists(cwd, issueSlug, filename, store)) available.push(filename);
    else missing.push(filename);
  }

  return { available, missing, count: available.length };
}

function deriveTaskProgress(cwd: string, issueSlug: string | null, phase: Phase | null, currentTaskIndex: number, completedTasks: number[], tddTaskState: TddTaskState | null): ContextTaskProgress | null {
  if (!issueSlug || !phase || !TASK_ORIENTED_PHASES.has(phase)) return null;
  const tasks = deriveTasks(cwd, issueSlug);
  if (tasks.length === 0) return null;
  const boundedIndex = Math.max(0, Math.min(currentTaskIndex, tasks.length - 1));
  const currentTaskNumber = boundedIndex + 1;
  const currentTaskId = tasks[boundedIndex]?.index;
  const currentTddState = tddTaskState?.taskIndex === currentTaskId ? tddTaskState.state : null;
  return {
    current: currentTaskNumber,
    total: tasks.length,
    completed: completedTasks.length,
    tddState: currentTddState,
  };
}

function promptSourceFor(phase: Phase | null, planMode: PlanMode): string {
  if (!phase) return "idle context";
  if (phase === "plan" && planMode) return `prompts/${resolvePlanTemplate(planMode)}`;
  if (phase === "spec") return "prompts/write-spec.md";
  if (phase === "reproduce") return "prompts/reproduce-bug.md";
  if (phase === "diagnose") return "prompts/diagnose-bug.md";
  if (phase === "implement") return "prompts/implement-task.md";
  return `prompts/${phase}.md`;
}

function deriveGuidance(issueSlug: string | null, workflow: WorkflowType | null, phase: Phase | null, planMode: PlanMode): ContextToolGuidanceSummary {
  let instructionSummary = "No active workflow phase guidance.";
  if (phase === "plan" && planMode) {
    const modeInstructions: Record<Exclude<PlanMode, null>, string> = {
      draft: "Create/update structured tasks with `megapowers_plan_task`, then call `megapowers_signal` with action `\"plan_draft_done\"` when the draft is ready for review.",
      revise: "Revise structured tasks with `megapowers_plan_task`, then call `megapowers_signal` with action `\"plan_draft_done\"` when the revision is ready for review.",
      review: "Review the structured plan and submit the verdict with `megapowers_plan_review`.",
    };
    instructionSummary = modeInstructions[planMode];
  } else if (issueSlug && workflow && phase) {
    const config = getWorkflowConfig(workflow);
    const phaseConfig = config.phases.find((p) => p.name === phase);
    if (phaseConfig) {
      const isTerminal = config.phases[config.phases.length - 1]?.name === phase;
      instructionSummary = deriveToolInstructions(phaseConfig, issueSlug, { isTerminal }) || instructionSummary;
    }
  }

  return {
    active: `${promptSourceFor(phase, planMode)} is active for ${workflow ?? "no-workflow"}/${phase ?? "idle"}${planMode ? ` (${planMode})` : ""}.`,
    reference: "Prompt markdown in prompts/*.md is the source of truth; docs/phase-tools.md is the compact review index.",
    availabilityNote: "Project-specific tools mentioned by guidance are preferred if available.",
    instructionSummary,
  };
}

export function buildContextSummary(cwd: string, store?: Store): MegapowersContextSummary {
  const state = readState(cwd);
  return {
    megaEnabled: state.megaEnabled,
    activeIssue: state.activeIssue,
    workflow: state.workflow,
    phase: state.phase,
    planMode: state.planMode,
    taskProgress: deriveTaskProgress(cwd, state.activeIssue, state.phase, state.currentTaskIndex, state.completedTasks, state.tddTaskState),
    artifacts: deriveArtifacts(cwd, state.activeIssue, state.workflow, store),
    toolGuidance: deriveGuidance(state.activeIssue, state.workflow, state.phase, state.planMode),
  };
}

export function formatCompactContextStatus(summary: MegapowersContextSummary): string {
  const parts = [`⚡ ${summary.workflow && summary.phase ? `${summary.workflow}/${summary.phase}` : "idle"}`];
  if (summary.phase === "plan" && summary.planMode) parts.push(`mode ${summary.planMode}`);
  if (summary.taskProgress) parts.push(`task ${summary.taskProgress.current}/${summary.taskProgress.total}`);
  parts.push(`${summary.artifacts.count} artifacts`);
  return parts.join(" • ");
}

function formatList(label: string, values: string[]): string[] {
  if (values.length === 0) return [`${label}: none`];
  return [`${label}:`, ...values.map((value) => `- ${value}`)];
}

export function renderContextReport(cwd: string, store?: Store, options?: { debug?: boolean }): string {
  const summary = buildContextSummary(cwd, store);
  const lines: string[] = [
    "# Megapowers Context",
    "",
    `Enabled: ${summary.megaEnabled ? "yes" : "no"}`,
    `Issue: ${summary.activeIssue ?? "none"}`,
    `Workflow: ${summary.workflow ?? "none"}`,
    `Phase: ${summary.phase ?? "none"}`,
  ];

  if (summary.phase === "plan" && summary.planMode) {
    lines.push(`Plan mode: ${summary.planMode}`);
  }

  lines.push("");
  lines.push("## Task state");
  if (summary.taskProgress) {
    lines.push(`Current task: ${summary.taskProgress.current}/${summary.taskProgress.total}`);
    lines.push(`Completed tasks: ${summary.taskProgress.completed}/${summary.taskProgress.total}`);
    lines.push(`TDD state: ${summary.taskProgress.tddState ?? "none"}`);
  } else {
    lines.push("Current task: none");
    lines.push("TDD state: none");
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push(`Artifact count: ${summary.artifacts.count}`);
  lines.push(...formatList("Available artifacts", summary.artifacts.available));
  lines.push(...formatList("Missing artifacts", summary.artifacts.missing));

  lines.push("");
  lines.push("## Tool guidance");
  lines.push(summary.toolGuidance.active);
  lines.push(summary.toolGuidance.reference);
  lines.push(summary.toolGuidance.availabilityNote);
  lines.push(summary.toolGuidance.instructionSummary);

  if (options?.debug) {
    lines.push("");
    lines.push("## Rendered prompt");
    lines.push(buildInjectedPrompt(cwd, store) ?? "No rendered prompt available.");
  }

  return lines.join("\n");
}
