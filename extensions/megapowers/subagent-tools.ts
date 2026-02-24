import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState } from "./state-io.js";
import { deriveTasks } from "./derived.js";
import { readSubagentStatus, subagentDir, type SubagentStatus } from "./subagent-status.js";
import { generateSubagentId } from "./subagent-runner.js";
import { validateTaskDependencies } from "./subagent-validate.js";
import { extractTaskSection, buildSubagentPrompt } from "./subagent-context.js";
import { resolveAgent } from "./subagent-agents.js";
import { buildDispatchConfig, type DispatchConfig } from "./subagent-async.js";
import { workspacePath } from "./subagent-workspace.js";
import { createStore } from "./store.js";

export interface SubagentDispatchInput {
  task: string;
  taskIndex?: number;
  agent?: string;
  timeoutMs?: number;
}

export interface SubagentDispatchResult {
  id?: string;
  config?: DispatchConfig;
  promptFilePath?: string;
  error?: string;
}

export interface SubagentStatusResult {
  status?: SubagentStatus;
  error?: string;
}

export interface JJCheck {
  isJJRepo: () => Promise<boolean>;
}

export async function handleSubagentDispatch(
  cwd: string,
  input: SubagentDispatchInput,
  jjCheck?: JJCheck,
): Promise<SubagentDispatchResult> {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  if (jjCheck) {
    const isRepo = await jjCheck.isJJRepo();
    if (!isRepo) {
      return { error: "jj is required for subagent workspace isolation. This does not appear to be a jj repository." };
    }
  }

  const agent = resolveAgent(input.agent, cwd);
  const id = generateSubagentId(input.taskIndex);

  const saDir = subagentDir(cwd, id);
  if (!existsSync(saDir)) mkdirSync(saDir, { recursive: true });

  let systemPromptPath: string | undefined;
  if (agent?.systemPrompt) {
    const promptPath = join(saDir, "agent-prompt.md");
    writeFileSync(promptPath, agent.systemPrompt);
    systemPromptPath = promptPath;
  }

  if (input.taskIndex !== undefined) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    const result = validateTaskDependencies(input.taskIndex, tasks, state.completedTasks);
    if (!result.valid) {
      const reason = result.unmetDependencies
        ? `Task ${input.taskIndex} depends on incomplete tasks: ${result.unmetDependencies.join(", ")}`
        : result.error ?? "Dependency validation failed.";
      return { error: reason };
    }
  }

  let planSection: string | undefined;
  if (input.taskIndex !== undefined) {
    const store = createStore(cwd);
    const planContent = store.readPlanFile(state.activeIssue, "plan.md");
    if (planContent) {
      planSection = extractTaskSection(planContent, input.taskIndex);
    }
  }

  const store = createStore(cwd);
  const learnings = store.getLearnings();

  const prompt = buildSubagentPrompt({
    taskDescription: input.task,
    planSection: planSection || undefined,
    learnings: learnings || undefined,
  });

  const promptFilePath = join(saDir, "prompt.md");
  writeFileSync(promptFilePath, prompt);

  const wsPath = workspacePath(cwd, id);

  const config = buildDispatchConfig({
    id,
    prompt,
    cwd,
    workspacePath: wsPath,
    timeoutMs: input.timeoutMs,
    model: agent?.model,
    tools: agent?.tools,
    systemPromptPath,
    thinking: agent?.thinking,
  });

  return { id, config, promptFilePath };
}

export function handleSubagentStatus(
  cwd: string,
  subagentId: string,
): SubagentStatusResult {
  const status = readSubagentStatus(cwd, subagentId);
  if (!status) {
    return { error: `Subagent '${subagentId}' not found. Check the ID and try again.` };
  }
  return { status };
}
