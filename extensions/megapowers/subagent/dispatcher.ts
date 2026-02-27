import type { Message } from "@mariozechner/pi-ai";

export interface DispatchConfig {
  agent: string;
  task: string;
  /** Working directory the subagent should run in (jj workspace path). */
  cwd: string;

  /** Optional overrides (mapped onto pi-subagents agent config / runSync options). */
  systemPrompt?: string;
  model?: string;
  tools?: string[];
  thinking?: string;

  timeoutMs?: number;

  /** Extra context appended to the task prompt */
  context?: string;
}

export interface DispatchResult {
  exitCode: number;
  messages: Message[];
  filesChanged: string[];
  testsPassed: boolean | null;
  error?: string;
}

export interface Dispatcher {
  dispatch(config: DispatchConfig): Promise<DispatchResult>;
}
