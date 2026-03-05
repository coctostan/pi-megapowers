/**
 * Ambient module declarations for pi-subagents.
 * Shadows the library's .ts source files so TypeScript doesn't type-check them
 * directly (pi-subagents v0.11.0 has an internal AgentSource type inconsistency).
 */

declare module "pi-subagents/agents.js" {
  export type AgentSource = "builtin" | "user" | "project";

  export interface AgentConfig {
    name: string;
    description: string;
    tools?: string[];
    mcpDirectTools?: string[];
    model?: string;
    thinking?: string;
    systemPrompt: string;
    source: AgentSource;
    filePath: string;
    skills?: string[];
    extensions?: string[];
    output?: string;
    defaultReads?: string[];
    defaultProgress?: boolean;
    interactive?: boolean;
    extraFields?: Record<string, string>;
  }

  export interface ChainConfig {
    name: string;
    description: string;
    source: AgentSource;
    filePath: string;
    steps: unknown[];
    extraFields?: Record<string, string>;
  }

  export interface AgentDiscoveryResult {
    agents: AgentConfig[];
    projectAgentsDir: string | null;
  }

  export function discoverAgents(cwd: string, scope: unknown): AgentDiscoveryResult;
}

declare module "pi-subagents/execution.js" {
  import type { AgentConfig } from "pi-subagents/agents.js";
  import type { RunSyncOptions, SingleResult } from "pi-subagents/types.js";

  export function runSync(
    runtimeCwd: string,
    agents: AgentConfig[],
    agentName: string,
    task: string,
    options: RunSyncOptions,
  ): Promise<SingleResult>;
}

declare module "pi-subagents/types.js" {
  // Use `any` to avoid structural conflicts with @mariozechner/pi-ai Message type
  export type Message = any;

  export interface Usage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: number;
    turns?: number;
  }

  export interface SingleResult {
    agent: string;
    task: string;
    exitCode: number;
    messages: Message[];
    usage: Usage;
    model?: string;
    error?: string;
    sessionFile?: string;
    skills?: string[];
    skillsWarning?: string;
    progress?: unknown;
    progressSummary?: unknown;
    artifactPaths?: unknown;
    truncation?: unknown;
  }

  export interface RunSyncOptions {
    cwd?: string;
    signal?: AbortSignal;
    onUpdate?: (r: unknown) => void;
    maxOutput?: unknown;
    artifactsDir?: string;
    artifactConfig?: unknown;
    runId: string;
    index?: number;
    sessionDir?: string;
    share?: boolean;
    modelOverride?: string;
    skills?: string[];
  }
}
