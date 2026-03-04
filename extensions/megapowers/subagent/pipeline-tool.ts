import type { Dispatcher } from "./dispatcher.js";
import { readState, writeState } from "../state/state-io.js";
import { deriveTasks } from "../state/derived.js";
import { createStore } from "../state/store.js";
import { handleSignal } from "../tools/tool-signal.js";

import { createPipelineWorkspace, squashPipelineWorkspace, type ExecGit } from "./pipeline-workspace.js";
import { runPipeline } from "./pipeline-runner.js";
import type { ExecShell } from "./pipeline-steps.js";
import { validateTaskDependencies } from "./task-deps.js";
import { writePipelineMeta, readPipelineMeta, clearPipelineMeta } from "./pipeline-meta.js";
import type { PipelineProgressEvent } from "./pipeline-renderer.js";

export interface PipelineToolInput {
  taskIndex: number;
  resume?: boolean;
  guidance?: string;
}

export interface PipelineToolOutput {
  pipelineId?: string;
  result?: any;
  paused?: { diff?: string; log?: any[]; errorSummary?: string };
  error?: string;
}

function extractTaskSection(planMd: string, taskIndex: number): string | undefined {
  const headerRe = new RegExp(`^###\\s+Task\\s+${taskIndex}:`, "m");
  const m = headerRe.exec(planMd);
  if (!m) return undefined;

  const start = m.index;
  const rest = planMd.slice(start);

  // Find the next task header (skip the current header at position 0).
  const nextHeaderIdx = rest.slice(1).search(/^###\s+Task\s+\d+:/m);
  const end = nextHeaderIdx === -1 ? start + rest.length : start + 1 + nextHeaderIdx;

  return planMd.slice(start, end).trim();
}

function setSkippedTddStateForTask(projectRoot: string, taskIndex: number): void {
  const s = readState(projectRoot);
  writeState(projectRoot, {
    ...s,
    tddTaskState: {
      taskIndex,
      state: "impl-allowed",
      skipped: true,
      skipReason: "Completed via pipeline (TDD audited + reviewed)",
    },
  });
}

export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
  execShell?: ExecShell,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<PipelineToolOutput> {
  const state = readState(projectRoot);

  if (!state.megaEnabled) return { error: "Megapowers is disabled." };
  if (!state.activeIssue) return { error: "No active issue." };
  if (state.phase !== "implement") return { error: "pipeline tool can only run during implement phase." };

  if (input.resume && (!input.guidance || input.guidance.trim().length === 0)) {
    return { error: "guidance is required when resuming a paused pipeline (resume: true)." };
  }

  const tasks = deriveTasks(projectRoot, state.activeIssue);
  const task = tasks.find((t) => t.index === input.taskIndex);
  if (!task) return { error: `Task ${input.taskIndex} not found in plan.` };

  const dep = validateTaskDependencies(task.index, tasks as any, state.completedTasks);
  if (!dep.valid) {
    return { error: dep.error ?? `Task ${task.index} depends on incomplete tasks: ${(dep.unmetDependencies ?? []).join(", ")}` };
  }

  let pipelineId: string;
  let workspacePath: string;

  if (input.resume) {
    const meta = readPipelineMeta(projectRoot, task.index);
    if (!meta) return { error: `No paused pipeline found for task ${task.index}.` };
    pipelineId = meta.pipelineId;
    workspacePath = meta.workspacePath;
  } else {
    pipelineId = `pipe-t${task.index}-${Date.now()}`;

    const ws = await createPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!ws.ok) return { error: `Workspace creation failed: ${ws.error}` };
    workspacePath = ws.workspacePath;
  }

  const store = createStore(projectRoot);
  const planMd = store.readPlanFile(state.activeIssue, "plan.md") ?? "";
  const planSection = extractTaskSection(planMd, task.index);

  const specFile = state.workflow === "bugfix" ? "diagnosis.md" : "spec.md";
  const specContent = store.readPlanFile(state.activeIssue, specFile) ?? undefined;
  const learnings = store.getLearnings() || undefined;

  const taskDescription = input.guidance
    ? `${task.description}\n\n## Guidance\n\n${input.guidance}`
    : task.description;

  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", reviewer: "reviewer" },
      execGit,
      execShell,
      onProgress,
    },
  );

  if (result.status === "completed") {
    const squash = await squashPipelineWorkspace(projectRoot, pipelineId, execGit);
    if (!squash.ok) return { error: `Squash failed: ${squash.error}`, pipelineId, result };

    clearPipelineMeta(projectRoot, task.index);

    // Ensure state machine completion isn't blocked by the legacy hard TDD gate.
    // This is safe because pipeline completion is gated by shell test command + reviewer
    // and includes a deterministic TDD audit report in the review context.
    setSkippedTddStateForTask(projectRoot, task.index);

    // Align currentTaskIndex with the task being completed so task_done completes the intended task.
    const s0 = readState(projectRoot);
    const idxInArray = tasks.findIndex((t) => t.index === task.index);
    if (idxInArray >= 0 && s0.currentTaskIndex !== idxInArray) {
      writeState(projectRoot, { ...s0, currentTaskIndex: idxInArray });
    }

    const signal = handleSignal(projectRoot, "task_done");
    if (signal.error) return { error: `task_done failed: ${signal.error}`, pipelineId, result };

    return { pipelineId, result };
  }

  writePipelineMeta(projectRoot, task.index, { pipelineId, workspacePath, createdAt: Date.now() });

  return {
    pipelineId,
    result,
    paused: {
      diff: result.diff,
      log: result.logEntries,
      errorSummary: result.errorSummary,
    },
  };
}
