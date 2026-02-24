export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export interface DispatchConfig {
  id: string;
  prompt: string;
  cwd: string;
  workspacePath: string;
  timeoutMs: number;
  model?: string;
  tools?: string[];
  thinking?: string;
  systemPromptPath?: string;
}

export interface DispatchInput {
  id: string;
  prompt: string;
  cwd: string;
  workspacePath: string;
  timeoutMs?: number;
  model?: string;
  tools?: string[];
  thinking?: string;
  systemPromptPath?: string;
}

export function buildDispatchConfig(input: DispatchInput): DispatchConfig {
  return {
    id: input.id,
    prompt: input.prompt,
    cwd: input.cwd,
    workspacePath: input.workspacePath,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    model: input.model,
    tools: input.tools,
    thinking: input.thinking,
    systemPromptPath: input.systemPromptPath,
  };
}
