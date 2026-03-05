import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { RunSyncOptions, SingleResult } from "pi-subagents/types.js";

export type RunSyncFn = (
  runtimeCwd: string,
  agents: AgentConfig[],
  agentName: string,
  task: string,
  options: RunSyncOptions,
) => Promise<SingleResult>;

export interface PiSubagentsDispatcherDeps {
  runSync: RunSyncFn;
  runtimeCwd: string;
  agents: AgentConfig[];
}

function buildTaskPrompt(task: string, context?: string): string {
  if (!context) return task;
  return `${task}\n\n## Context\n\n${context}`;
}

function applyAgentOverrides(base: AgentConfig, cfg: DispatchConfig): AgentConfig {
  const mergedPrompt = cfg.systemPrompt ? `${base.systemPrompt}\n\n${cfg.systemPrompt}` : base.systemPrompt;

  return {
    ...base,
    model: cfg.model ?? base.model,
    thinking: cfg.thinking ?? base.thinking,
    tools: cfg.tools ?? base.tools,
    systemPrompt: mergedPrompt,
  };
}

let runCounter = 0;

export class PiSubagentsDispatcher implements Dispatcher {
  constructor(private deps: PiSubagentsDispatcherDeps) {}

  async dispatch(config: DispatchConfig): Promise<DispatchResult> {
    const baseAgent = this.deps.agents.find((a) => a.name === config.agent);
    const agents = baseAgent
      ? this.deps.agents.map((a) => (a.name === config.agent ? applyAgentOverrides(a, config) : a))
      : this.deps.agents;

    const taskPrompt = buildTaskPrompt(config.task, config.context);

    try {
      const result = await this.deps.runSync(this.deps.runtimeCwd, agents, config.agent, taskPrompt, {
        runId: `mega-pipe-${Date.now()}-${++runCounter}`,
        cwd: config.cwd,
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
        modelOverride: config.model,
      });

      return {
        exitCode: result.exitCode,
        messages: result.messages as DispatchResult["messages"],
        filesChanged: [],
        testsPassed: null,
        error: (result as any).error,
      };
    } catch (err) {
      return {
        exitCode: 1,
        messages: [],
        filesChanged: [],
        testsPassed: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
