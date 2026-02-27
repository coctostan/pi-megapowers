import type { Message } from "@mariozechner/pi-ai";

export interface ToolCallRecord {
  tool: string;
  args: Record<string, any>;
  output?: string;
}

const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/i,
  /\bnpm\s+test\b/i,
  /\bpnpm\s+test\b/i,
  /\byarn\s+test\b/i,
  /\bnpx?\s+(jest|vitest|mocha)\b/i,
];

const PASS_PATTERN = /(\d+)\s+pass/i;
const FAIL_PATTERN = /(\d+)\s+fail/i;

function isTestCommand(cmd: string): boolean {
  return TEST_COMMAND_PATTERNS.some((p) => p.test(cmd));
}

export function extractFilesChanged(messages: Message[]): string[] {
  const files = new Set<string>();

  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      if (block?.name !== "write" && block?.name !== "edit") continue;
      const p = block?.input?.path;
      if (typeof p === "string") files.add(p);
    }
  }

  return [...files];
}

export function extractFinalOutput(messages: Message[]): string {
  const parts: string[] = [];

  for (const msg of messages as any[]) {
    if (msg?.role !== "assistant") continue;
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === "text" && typeof block?.text === "string") {
        parts.push(block.text);
      }
    }
  }

  return parts.join("\n");
}

export function extractTestsPassed(messages: Message[]): boolean | null {
  const testBashIds = new Set<string>();

  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      if (block?.name !== "bash") continue;
      const cmd = block?.input?.command;
      if (typeof cmd === "string" && isTestCommand(cmd) && typeof block?.id === "string") {
        testBashIds.add(block.id);
      }
    }
  }

  if (testBashIds.size === 0) return null;

  let last: boolean | null = null;

  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== "tool_result") continue;
      if (!testBashIds.has(block?.tool_use_id)) continue;
      const text = typeof block?.content === "string" ? block.content : "";
      const pass = text.match(PASS_PATTERN);
      const fail = text.match(FAIL_PATTERN);
      if (!pass && !fail) continue;
      const failCount = fail ? parseInt(fail[1], 10) : 0;
      last = failCount === 0;
    }
  }

  return last;
}

export function extractToolCalls(messages: Message[]): ToolCallRecord[] {
  const calls: ToolCallRecord[] = [];
  const idToIndex = new Map<string, number>();

  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === "tool_use" && typeof block?.name === "string") {
        const idx = calls.push({ tool: block.name, args: (block.input ?? {}) as any }) - 1;
        if (typeof block?.id === "string") idToIndex.set(block.id, idx);
      }

      if (block?.type === "tool_result" && typeof block?.tool_use_id === "string") {
        const idx = idToIndex.get(block.tool_use_id);
        if (idx === undefined) continue;
        const text = typeof block?.content === "string" ? block.content : "";
        calls[idx] = { ...calls[idx], output: text };
      }
    }
  }

  return calls;
}

/**
 * Extract raw test command output from tool_result blocks.
 * Returns the last test command's output, or null if no test commands found.
 */
export function extractTestOutput(messages: Message[]): string | null {
  const testBashIds = new Set<string>();
  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      if (block?.name !== "bash") continue;
      const cmd = block?.input?.command;
      if (typeof cmd === "string" && isTestCommand(cmd) && typeof block?.id === "string") {
        testBashIds.add(block.id);
      }
    }
  }

  if (testBashIds.size === 0) return null;

  let lastOutput: string | null = null;

  for (const msg of messages as any[]) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type !== "tool_result") continue;
      if (!testBashIds.has(block?.tool_use_id)) continue;
      const text = typeof block?.content === "string" ? block.content : "";
      if (text) lastOutput = text;
    }
  }
  return lastOutput;
}

// Internal export for other modules in this package
export const __internal = { isTestCommand };
