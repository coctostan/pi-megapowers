import { randomUUID } from "node:crypto";
import type { MessageLine } from "./subagent-errors.js";

export function generateSubagentId(taskIndex?: number): string {
  const suffix = randomUUID().slice(0, 8);
  if (taskIndex !== undefined) return `sa-t${taskIndex}-${suffix}`;
  return `sa-${suffix}`;
}

export interface SpawnOptions {
  model?: string;
  tools?: string[];
  thinking?: string;
  systemPromptPath?: string;
}

export function buildSpawnArgs(promptFilePath: string, options?: SpawnOptions): string[] {
  const args = ["pi", "--mode", "json", "-p", "--no-session"];
  if (options?.model) args.push("--model", options.model);
  if (options?.tools && options.tools.length > 0) args.push("--tools", options.tools.join(","));
  if (options?.thinking) args.push("--thinking", options.thinking);
  if (options?.systemPromptPath) args.push("--append-system-prompt", options.systemPromptPath);
  args.push(`@${promptFilePath}`);
  return args;
}

export interface SpawnEnvOptions {
  subagentId?: string;
  projectRoot?: string;
}

export function buildSpawnEnv(options?: SpawnEnvOptions): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PI_SUBAGENT: "1",
  };
  if (options?.subagentId) env.MEGA_SUBAGENT_ID = options.subagentId;
  if (options?.projectRoot) env.MEGA_PROJECT_ROOT = options.projectRoot;
  return env;
}

interface PendingToolCall {
  toolName: string;
  args: Record<string, any>;
}

export interface RunnerState {
  id: string;
  startedAt: number;
  turnsUsed: number;
  errorLines: MessageLine[];
  lastTestPassed: boolean | undefined;
  isTerminal: boolean;
  timedOut?: boolean;
  pendingToolCalls: Map<string, PendingToolCall>;
}

export function createRunnerState(id: string, startedAt: number): RunnerState {
  return {
    id,
    startedAt,
    turnsUsed: 0,
    errorLines: [],
    lastTestPassed: undefined,
    isTerminal: false,
    timedOut: false,
    pendingToolCalls: new Map(),
  };
}

const TEST_PASS_PATTERN = /(\d+)\s+pass/i;
const TEST_FAIL_PATTERN = /(\d+)\s+fail/i;
const ERROR_LINE_PATTERN = /Error:|TypeError:|ReferenceError:|SyntaxError:|ENOENT:/i;

const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/,
  /\bnpx?\s+(jest|vitest|mocha)\b/,
  /\bpnpm\s+test\b/,
  /\byarn\s+test\b/,
  /\bnpm\s+test\b/,
];

function isTestCommand(command: string): boolean {
  return TEST_COMMAND_PATTERNS.some(p => p.test(command));
}

function extractResultText(result: any): string {
  if (!result?.content || !Array.isArray(result.content)) return "";
  return result.content
    .filter((c: any) => c.type === "text" && c.text)
    .map((c: any) => c.text)
    .join("\n");
}

export function processJsonlLine(state: RunnerState, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  let event: any;
  try { event = JSON.parse(trimmed); } catch { return; }

  if (event.type === "message_end" && event.message?.role === "assistant") {
    state.turnsUsed++;
    const content = event.message.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "text" && part.text && ERROR_LINE_PATTERN.test(part.text)) {
          const errorMatch = part.text.match(/(?:Error|TypeError|ReferenceError|SyntaxError|ENOENT):[^\n]*/i);
          if (errorMatch) {
            state.errorLines.push({ type: "error", text: errorMatch[0].slice(0, 200) });
          }
        }
      }
    }
  }

  if (event.type === "tool_execution_start" && event.toolCallId) {
    state.pendingToolCalls.set(event.toolCallId, {
      toolName: event.toolName,
      args: event.args ?? {},
    });
  }

  if (event.type === "tool_execution_end" && event.toolCallId) {
    const pending = state.pendingToolCalls.get(event.toolCallId);
    state.pendingToolCalls.delete(event.toolCallId);

    const resultText = extractResultText(event.result);

    if (event.isError || ERROR_LINE_PATTERN.test(resultText)) {
      if (resultText) {
        state.errorLines.push({ type: "error", text: resultText.slice(0, 200) });
      }
    }

    const toolName = event.toolName ?? pending?.toolName;
    const command = pending?.args?.command ?? "";
    if (toolName === "bash" && resultText && isTestCommand(command)) {
      const passMatch = resultText.match(TEST_PASS_PATTERN);
      const failMatch = resultText.match(TEST_FAIL_PATTERN);
      if (passMatch || failMatch) {
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 0;
        state.lastTestPassed = failCount === 0;
      }
    }
  }
}
