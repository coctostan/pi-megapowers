/**
 * Ambient module declarations for pi-subagents.
 * Provides correct types for our usage without type-checking the library's
 * source files (which have an internal AgentSource type inconsistency in v0.11.0).
 */
declare module "pi-subagents/agents.js" {
  export type AgentSource = "builtin" | "user" | "project";

  export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    source: AgentSource;
    file: string;
  }

  export interface AgentDiscoveryResult {
    agents: AgentConfig[];
    chains: unknown[];
  }

  export function discoverAgents(cwd: string, scope: unknown): AgentDiscoveryResult;
  export function discoverAgentsAll(cwd: string): {
    builtin: AgentConfig[];
    user: AgentConfig[];
    project: AgentConfig[];
  };
}

declare module "pi-subagents/execution.js" {
  export function runSync(
    cwd: string,
    agent: string,
    args: unknown,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}
