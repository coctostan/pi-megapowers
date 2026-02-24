import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const thisDir = dirname(fileURLToPath(import.meta.url));
export const BUILTIN_AGENTS_DIR = join(thisDir, "..", "..", "agents");

export interface AgentDef {
  name: string;
  model?: string;
  tools?: string[];
  thinking?: string;
  systemPrompt?: string;
}

/**
 * Parse agent definition from markdown with YAML frontmatter.
 * Compatible with pi-subagents format.
 *
 * Supports three formats for the `tools` field:
 * - Inline YAML array: `tools: [read, write, bash]`
 * - Comma-separated:   `tools: read, write, bash`
 * - Multiline YAML:    `tools:\n  - read\n  - write\n  - bash`
 */
export function parseAgentFrontmatter(content: string): AgentDef | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  // Parse frontmatter with multiline array support
  const data: Record<string, string> = {};
  const multilineArrays: Record<string, string[]> = {};
  const lines = frontmatter.split("\n");
  let currentArrayKey: string | null = null;

  for (const line of lines) {
    const dashItem = line.match(/^\s+-\s+(.+)$/);
    if (dashItem && currentArrayKey) {
      if (!multilineArrays[currentArrayKey]) multilineArrays[currentArrayKey] = [];
      multilineArrays[currentArrayKey].push(dashItem[1].trim());
      continue;
    }

    const kvWithValue = line.match(/^(\w+):\s+(.+)$/);
    const kvEmpty = line.match(/^(\w+):\s*$/);

    if (kvWithValue) {
      currentArrayKey = null;
      data[kvWithValue[1]] = kvWithValue[2].trim();
    } else if (kvEmpty) {
      currentArrayKey = kvEmpty[1];
    } else {
      currentArrayKey = null;
    }
  }

  if (!data.name) return null;

  const agent: AgentDef = { name: data.name };
  if (data.model) agent.model = data.model;
  if (data.thinking) agent.thinking = data.thinking;

  if (multilineArrays.tools && multilineArrays.tools.length > 0) {
    agent.tools = multilineArrays.tools;
  } else if (data.tools) {
    const raw = data.tools.replace(/^\[|\]$/g, "");
    agent.tools = raw.split(",").map(s => s.trim()).filter(Boolean);
  }

  if (body) agent.systemPrompt = body;

  return agent;
}

/**
 * Search directories in priority order for an agent markdown file.
 * Priority: project .megapowers/agents/ → user ~/.megapowers/agents/ → builtin agents/
 */
export function resolveAgent(
  name: string | undefined,
  cwd: string,
  homeDirectory?: string,
): AgentDef | null {
  const agentName = name ?? "worker";
  const filename = `${agentName}.md`;

  const searchDirs = [
    join(cwd, ".megapowers", "agents"),
    join(homeDirectory ?? homedir(), ".megapowers", "agents"),
    BUILTIN_AGENTS_DIR,
  ];

  for (const dir of searchDirs) {
    const filepath = join(dir, filename);
    if (existsSync(filepath)) {
      try {
        const content = readFileSync(filepath, "utf-8");
        const parsed = parseAgentFrontmatter(content);
        if (parsed) return parsed;
        continue;
      } catch {
        continue;
      }
    }
  }

  return null;
}
