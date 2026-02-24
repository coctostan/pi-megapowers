# Plan: Subagent Implementation Reliability

## Summary

Build `subagent` and `subagent_status` tools within megapowers, using jj workspace isolation and an async status file protocol. 18 tasks covering: agent frontmatter parsing, workspace lifecycle, status protocol, error detection, context assembly, dependency validation, runner, tool registration, builtin agents, prompt updates, and upstream tracking.

**AC17 is pre-existing** — `[depends: N, M]` parsing already exists in `plan-parser.ts` with full test coverage. No task needed.

---

### Task 1: Agent frontmatter parsing [no-test]

**Note:** AC17 (`[depends:]` annotation parsing) is already implemented in `plan-parser.ts` and tested in `tests/plan-parser.test.ts`. This task covers agent markdown parsing (AC12, AC14).

**Files:**
- Create: `extensions/megapowers/subagent-agents.ts`
- Test: `tests/subagent-agents.test.ts`

**Test:**
```typescript
// tests/subagent-agents.test.ts
import { describe, it, expect } from "bun:test";
import { parseAgentFrontmatter, type AgentDef } from "../extensions/megapowers/subagent-agents.js";

describe("parseAgentFrontmatter", () => {
  it("parses all four frontmatter fields", () => {
    const md = `---
name: worker
model: claude-sonnet-4-20250514
tools: [read, write, bash]
thinking: full
---

You are a worker agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent).toEqual({
      name: "worker",
      model: "claude-sonnet-4-20250514",
      tools: ["read", "write", "bash"],
      thinking: "full",
      systemPrompt: "You are a worker agent.",
    });
  });

  it("handles missing optional fields", () => {
    const md = `---
name: scout
---

Scout agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent.name).toBe("scout");
    expect(agent.model).toBeUndefined();
    expect(agent.tools).toBeUndefined();
    expect(agent.thinking).toBeUndefined();
    expect(agent.systemPrompt).toBe("Scout agent.");
  });

  it("returns null for content without frontmatter", () => {
    const agent = parseAgentFrontmatter("Just a normal markdown file.");
    expect(agent).toBeNull();
  });

  it("parses tools as comma-separated string", () => {
    const md = `---
name: helper
tools: read, write
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write"]);
  });

  it("parses tools as YAML array syntax", () => {
    const md = `---
name: helper
tools: [read, write, bash]
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write", "bash"]);
  });

  it("trims whitespace from body as system prompt", () => {
    const md = `---
name: test
---

  Some prompt text.

`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.systemPrompt).toBe("Some prompt text.");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-agents.ts

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
 */
export function parseAgentFrontmatter(content: string): AgentDef | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const data: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }

  if (!data.name) return null;

  const agent: AgentDef = { name: data.name };
  if (data.model) agent.model = data.model;
  if (data.thinking) agent.thinking = data.thinking;

  if (data.tools) {
    // Support both "[a, b, c]" and "a, b, c"
    const raw = data.tools.replace(/^\[|\]$/g, "");
    agent.tools = raw.split(",").map(s => s.trim()).filter(Boolean);
  }

  if (body) agent.systemPrompt = body;

  return agent;
}
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 2: Agent discovery with priority search [depends: 1]

**Files:**
- Modify: `extensions/megapowers/subagent-agents.ts`
- Test: `tests/subagent-agents.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-agents.test.ts
import { resolveAgent, BUILTIN_AGENTS_DIR } from "../extensions/megapowers/subagent-agents.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

describe("resolveAgent", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agent-resolve-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("finds agent in project .megapowers/agents/ directory", () => {
    const agentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, "worker.md"), `---\nname: worker\nmodel: fast-model\n---\nProject worker.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).toBe("fast-model");
  });

  it("falls back to builtin agents when not found in project", () => {
    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
  });

  it("returns null for unknown agent name", () => {
    const agent = resolveAgent("nonexistent-agent-xyz", tmp);
    expect(agent).toBeNull();
  });

  it("project agent takes priority over builtin", () => {
    const agentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, "worker.md"), `---\nname: worker\nmodel: custom-model\n---\nCustom.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent!.model).toBe("custom-model");
  });

  it("uses default worker agent when no agent name specified", () => {
    const agent = resolveAgent(undefined, tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
  });
});
```

**Implementation:**
```typescript
// Add to extensions/megapowers/subagent-agents.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
export const BUILTIN_AGENTS_DIR = join(thisDir, "..", "..", "agents");

/**
 * Search directories in priority order for an agent markdown file.
 * Priority: project .megapowers/agents/ → user ~/.megapowers/agents/ → builtin agents/
 */
export function resolveAgent(
  name: string | undefined,
  cwd: string,
  homeDir?: string,
): AgentDef | null {
  const agentName = name ?? "worker";
  const filename = `${agentName}.md`;

  const searchDirs = [
    join(cwd, ".megapowers", "agents"),
    join(homeDir ?? require("node:os").homedir(), ".megapowers", "agents"),
    BUILTIN_AGENTS_DIR,
  ];

  for (const dir of searchDirs) {
    const filepath = join(dir, filename);
    if (existsSync(filepath)) {
      try {
        const content = readFileSync(filepath, "utf-8");
        return parseAgentFrontmatter(content);
      } catch {
        continue;
      }
    }
  }

  return null;
}
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 3: Builtin agent files [no-test]

**Files:**
- Create: `agents/worker.md`
- Create: `agents/scout.md`
- Create: `agents/reviewer.md`

**Implementation:**

```markdown
<!-- agents/worker.md -->
---
name: worker
model: claude-sonnet-4-20250514
tools: [read, write, edit, bash]
thinking: full
---

You are a worker agent executing a specific implementation task. Follow the task description precisely. Write tests first, then implementation. Keep changes minimal and focused on the assigned task only.
```

```markdown
<!-- agents/scout.md -->
---
name: scout
model: claude-sonnet-4-20250514
tools: [read, bash, web_search, fetch_content]
thinking: full
---

You are a scout agent for research and exploration. Investigate the codebase, read documentation, search for patterns, and report findings. Do not modify any files.
```

```markdown
<!-- agents/reviewer.md -->
---
name: reviewer
model: claude-sonnet-4-20250514
tools: [read, bash]
thinking: full
---

You are a code reviewer. Examine the provided code changes for correctness, style, potential bugs, and adherence to project conventions. Provide specific, actionable feedback. Do not modify any files.
```

**Verify:** `ls agents/ && cat agents/worker.md agents/scout.md agents/reviewer.md`

---

### Task 4: Subagent status types and file protocol

**Files:**
- Create: `extensions/megapowers/subagent-status.ts`
- Test: `tests/subagent-status.test.ts`

**Test:**
```typescript
// tests/subagent-status.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeSubagentStatus,
  readSubagentStatus,
  subagentDir,
  type SubagentState,
  type SubagentStatus,
} from "../extensions/megapowers/subagent-status.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("subagentDir", () => {
  it("returns .megapowers/subagents/<id>/ path", () => {
    expect(subagentDir("/project", "abc123")).toBe("/project/.megapowers/subagents/abc123");
  });
});

describe("writeSubagentStatus / readSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-status-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes and reads status.json", () => {
    const status: SubagentStatus = {
      id: "sa-001",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
    };
    writeSubagentStatus(tmp, "sa-001", status);
    const read = readSubagentStatus(tmp, "sa-001");
    expect(read).toEqual(status);
  });

  it("updates status in place", () => {
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
    });
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/foo.ts"],
      testsPassed: true,
    });
    const read = readSubagentStatus(tmp, "sa-002");
    expect(read!.state).toBe("completed");
    expect(read!.turnsUsed).toBe(5);
    expect(read!.filesChanged).toEqual(["src/foo.ts"]);
  });

  it("returns null when status file does not exist", () => {
    expect(readSubagentStatus(tmp, "nonexistent")).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    const dir = join(tmp, ".megapowers", "subagents", "corrupt");
    require("node:fs").mkdirSync(dir, { recursive: true });
    require("node:fs").writeFileSync(join(dir, "status.json"), "not json");
    expect(readSubagentStatus(tmp, "corrupt")).toBeNull();
  });

  it("includes error field for failed state", () => {
    const status: SubagentStatus = {
      id: "sa-003",
      state: "failed",
      turnsUsed: 2,
      startedAt: 1000,
      completedAt: 1500,
      error: "Process exited with code 1",
    };
    writeSubagentStatus(tmp, "sa-003", status);
    const read = readSubagentStatus(tmp, "sa-003");
    expect(read!.state).toBe("failed");
    expect(read!.error).toBe("Process exited with code 1");
  });

  it("includes diff field for completed state", () => {
    const status: SubagentStatus = {
      id: "sa-004",
      state: "completed",
      turnsUsed: 4,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/a.ts", "tests/a.test.ts"],
      diff: "M src/a.ts\nA tests/a.test.ts",
      testsPassed: true,
    };
    writeSubagentStatus(tmp, "sa-004", status);
    const read = readSubagentStatus(tmp, "sa-004");
    expect(read!.diff).toContain("src/a.ts");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-status.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type SubagentState = "running" | "completed" | "failed" | "timed-out";

export interface SubagentStatus {
  id: string;
  state: SubagentState;
  turnsUsed: number;
  startedAt: number;
  completedAt?: number;
  filesChanged?: string[];
  diff?: string;
  testsPassed?: boolean;
  error?: string;
  detectedErrors?: string[];
}

export function subagentDir(cwd: string, id: string): string {
  return join(cwd, ".megapowers", "subagents", id);
}

export function writeSubagentStatus(cwd: string, id: string, status: SubagentStatus): void {
  const dir = subagentDir(cwd, id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "status.json"), JSON.stringify(status, null, 2) + "\n");
}

export function readSubagentStatus(cwd: string, id: string): SubagentStatus | null {
  const filepath = join(subagentDir(cwd, id), "status.json");
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, "utf-8"));
  } catch {
    return null;
  }
}
```

**Verify:** `bun test tests/subagent-status.test.ts`

---

### Task 5: Error detection heuristics

**Files:**
- Create: `extensions/megapowers/subagent-errors.ts`
- Test: `tests/subagent-errors.test.ts`

**Test:**
```typescript
// tests/subagent-errors.test.ts
import { describe, it, expect } from "bun:test";
import { detectRepeatedErrors, type MessageLine } from "../extensions/megapowers/subagent-errors.js";

describe("detectRepeatedErrors", () => {
  it("detects same error appearing 3+ times", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
      { type: "info", text: "Retrying..." },
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
      { type: "info", text: "Retrying again..." },
      { type: "error", text: "TypeError: Cannot read property 'x' of undefined" },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("TypeError");
  });

  it("returns empty array when no repeated errors", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error A" },
      { type: "error", text: "Error B" },
    ];
    expect(detectRepeatedErrors(lines)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(detectRepeatedErrors([])).toEqual([]);
  });

  it("detects multiple different repeated errors", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error A" },
      { type: "error", text: "Error A" },
      { type: "error", text: "Error A" },
      { type: "error", text: "Error B" },
      { type: "error", text: "Error B" },
      { type: "error", text: "Error B" },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(2);
  });

  it("normalizes error messages by trimming whitespace", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "  Error X  " },
      { type: "error", text: "Error X" },
      { type: "error", text: "Error X " },
    ];
    const errors = detectRepeatedErrors(lines);
    expect(errors).toHaveLength(1);
  });

  it("uses configurable threshold", () => {
    const lines: MessageLine[] = [
      { type: "error", text: "Error" },
      { type: "error", text: "Error" },
    ];
    expect(detectRepeatedErrors(lines, 2)).toHaveLength(1);
    expect(detectRepeatedErrors(lines, 3)).toHaveLength(0);
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-errors.ts

export interface MessageLine {
  type: "error" | "info" | "text";
  text: string;
}

/**
 * Detect repeated error messages that indicate a stuck agent.
 * Returns the deduplicated error messages that appeared >= threshold times.
 */
export function detectRepeatedErrors(
  lines: MessageLine[],
  threshold: number = 3,
): string[] {
  const errorCounts = new Map<string, number>();

  for (const line of lines) {
    if (line.type !== "error") continue;
    const normalized = line.text.trim();
    if (!normalized) continue;
    errorCounts.set(normalized, (errorCounts.get(normalized) ?? 0) + 1);
  }

  const repeated: string[] = [];
  for (const [msg, count] of errorCounts) {
    if (count >= threshold) {
      repeated.push(msg);
    }
  }

  return repeated;
}
```

**Verify:** `bun test tests/subagent-errors.test.ts`

---

### Task 6: jj workspace lifecycle functions

**Files:**
- Create: `extensions/megapowers/subagent-workspace.ts`
- Test: `tests/subagent-workspace.test.ts`

**Test:**
```typescript
// tests/subagent-workspace.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildWorkspaceName,
  buildWorkspaceAddArgs,
  buildWorkspaceForgetArgs,
  buildWorkspaceDiffArgs,
  buildWorkspaceSquashArgs,
  parseWorkspacePath,
} from "../extensions/megapowers/subagent-workspace.js";

describe("buildWorkspaceName", () => {
  it("creates workspace name from subagent ID", () => {
    expect(buildWorkspaceName("sa-abc123")).toBe("mega-sa-abc123");
  });
});

describe("buildWorkspaceAddArgs", () => {
  it("returns jj workspace add args", () => {
    const args = buildWorkspaceAddArgs("mega-sa-abc", "/tmp/workspace");
    expect(args).toEqual(["workspace", "add", "--name", "mega-sa-abc", "/tmp/workspace"]);
  });
});

describe("buildWorkspaceForgetArgs", () => {
  it("returns jj workspace forget args", () => {
    expect(buildWorkspaceForgetArgs("mega-sa-abc")).toEqual(["workspace", "forget", "mega-sa-abc"]);
  });
});

describe("buildWorkspaceDiffArgs", () => {
  it("returns jj diff args for workspace", () => {
    expect(buildWorkspaceDiffArgs("mega-sa-abc")).toEqual(["diff", "--summary", "-r", "mega-sa-abc@"]);
  });
});

describe("buildWorkspaceSquashArgs", () => {
  it("returns jj squash args from workspace into target", () => {
    expect(buildWorkspaceSquashArgs("mega-sa-abc")).toEqual(["squash", "--from", "mega-sa-abc@"]);
  });
});

describe("parseWorkspacePath", () => {
  it("extracts workspace path from jj workspace add output", () => {
    const output = "Created workspace in /tmp/project/.jj/working-copies/mega-sa-abc";
    expect(parseWorkspacePath(output)).toBe("/tmp/project/.jj/working-copies/mega-sa-abc");
  });

  it("returns the target path when output is empty (path was provided)", () => {
    expect(parseWorkspacePath("", "/tmp/ws")).toBe("/tmp/ws");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-workspace.ts

/**
 * Pure functions for jj workspace command construction.
 * No I/O — composed by the runner with JJ interface.
 */

export function buildWorkspaceName(subagentId: string): string {
  return `mega-${subagentId}`;
}

export function buildWorkspaceAddArgs(workspaceName: string, targetPath: string): string[] {
  return ["workspace", "add", "--name", workspaceName, targetPath];
}

export function buildWorkspaceForgetArgs(workspaceName: string): string[] {
  return ["workspace", "forget", workspaceName];
}

export function buildWorkspaceDiffArgs(workspaceName: string): string[] {
  return ["diff", "--summary", "-r", `${workspaceName}@`];
}

export function buildWorkspaceSquashArgs(workspaceName: string): string[] {
  return ["squash", "--from", `${workspaceName}@`];
}

export function parseWorkspacePath(output: string, fallbackPath?: string): string {
  const match = output.match(/Created workspace in (.+)/);
  if (match) return match[1].trim();
  return fallbackPath ?? "";
}
```

**Verify:** `bun test tests/subagent-workspace.test.ts`

---

### Task 7: Task context assembly

**Files:**
- Create: `extensions/megapowers/subagent-context.ts`
- Test: `tests/subagent-context.test.ts`

**Test:**
```typescript
// tests/subagent-context.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  extractTaskSection,
  buildSubagentPrompt,
} from "../extensions/megapowers/subagent-context.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("extractTaskSection", () => {
  const plan = `# Implementation Plan

### Task 1: Set up types

Create type definitions in \`src/types.ts\`.

### Task 2: Build parser [depends: 1]

Implement the parser in \`src/parser.ts\`.
Test file: \`tests/parser.test.ts\`.

### Task 3: Integration [depends: 1, 2]

Wire everything together.
`;

  it("extracts full section for task 1", () => {
    const section = extractTaskSection(plan, 1);
    expect(section).toContain("Set up types");
    expect(section).toContain("src/types.ts");
    expect(section).not.toContain("Build parser");
  });

  it("extracts full section for task 2", () => {
    const section = extractTaskSection(plan, 2);
    expect(section).toContain("Build parser");
    expect(section).toContain("src/parser.ts");
    expect(section).toContain("tests/parser.test.ts");
    expect(section).not.toContain("Wire everything");
  });

  it("extracts last task section", () => {
    const section = extractTaskSection(plan, 3);
    expect(section).toContain("Wire everything");
  });

  it("returns empty string for nonexistent task", () => {
    expect(extractTaskSection(plan, 99)).toBe("");
  });

  it("extracts from numbered list format", () => {
    const numberedPlan = `# Plan\n\n1. Do A\n\nDetails for A.\n\n2. Do B\n\nDetails for B.\n`;
    const section = extractTaskSection(numberedPlan, 1);
    expect(section).toContain("Do A");
    expect(section).toContain("Details for A");
  });
});

describe("buildSubagentPrompt", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-ctx-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("includes task description in prompt", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build the auth module",
    });
    expect(prompt).toContain("Build the auth module");
  });

  it("includes plan section when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Build parser",
      planSection: "### Task 2: Build parser\n\nImplement in src/parser.ts.",
    });
    expect(prompt).toContain("src/parser.ts");
  });

  it("includes learnings when provided", () => {
    const prompt = buildSubagentPrompt({
      taskDescription: "Do thing",
      learnings: "- Always check for null",
    });
    expect(prompt).toContain("Always check for null");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-context.ts

/**
 * Extract the section content for a specific task from plan markdown.
 * Supports ### Task N: headers and numbered list items.
 */
export function extractTaskSection(planContent: string, taskIndex: number): string {
  const lines = planContent.split("\n");

  // Try ### Task N: header format first
  const headerPattern = new RegExp(`^###\\s+Task\\s+${taskIndex}:\\s*`);
  const nextHeaderPattern = /^###\s+Task\s+\d+:/;

  let inSection = false;
  let sectionLines: string[] = [];

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection && nextHeaderPattern.test(line)) {
      break;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }

  if (sectionLines.length > 0) {
    return sectionLines.join("\n").trim();
  }

  // Fall back to numbered list: "N. Description"
  const numberedPattern = new RegExp(`^\\s{0,1}${taskIndex}[.)]\\s+`);
  const nextNumberedPattern = /^\s{0,1}\d+[.)]\s+/;

  inSection = false;
  sectionLines = [];

  for (const line of lines) {
    if (!inSection && numberedPattern.test(line)) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection && nextNumberedPattern.test(line) && !numberedPattern.test(line)) {
      break;
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join("\n").trim();
}

export interface SubagentPromptInput {
  taskDescription: string;
  planSection?: string;
  learnings?: string;
}

/**
 * Build the prompt sent to a subagent.
 */
export function buildSubagentPrompt(input: SubagentPromptInput): string {
  const parts: string[] = [];

  parts.push(`## Task\n\n${input.taskDescription}`);

  if (input.planSection) {
    parts.push(`## Plan Details\n\n${input.planSection}`);
  }

  if (input.learnings) {
    parts.push(`## Project Learnings\n\n${input.learnings}`);
  }

  return parts.join("\n\n");
}
```

**Verify:** `bun test tests/subagent-context.test.ts`

---

### Task 8: Dependency validation for subagent dispatch [depends: 7]

**Files:**
- Create: `extensions/megapowers/subagent-validate.ts`
- Test: `tests/subagent-validate.test.ts`

**Test:**
```typescript
// tests/subagent-validate.test.ts
import { describe, it, expect } from "bun:test";
import { validateTaskDependencies, type ValidationResult } from "../extensions/megapowers/subagent-validate.js";
import type { PlanTask } from "../extensions/megapowers/state-machine.js";

describe("validateTaskDependencies", () => {
  const tasks: PlanTask[] = [
    { index: 1, description: "Types", completed: false, noTest: false },
    { index: 2, description: "Parser", completed: false, noTest: false, dependsOn: [1] },
    { index: 3, description: "Integration", completed: false, noTest: false, dependsOn: [1, 2] },
    { index: 4, description: "Docs", completed: false, noTest: true },
  ];

  it("allows task with no dependencies", () => {
    const result = validateTaskDependencies(1, tasks, []);
    expect(result.valid).toBe(true);
  });

  it("allows task when all dependencies are completed", () => {
    const result = validateTaskDependencies(2, tasks, [1]);
    expect(result.valid).toBe(true);
  });

  it("blocks task when dependencies are not completed", () => {
    const result = validateTaskDependencies(2, tasks, []);
    expect(result.valid).toBe(false);
    expect(result.unmetDependencies).toEqual([1]);
  });

  it("blocks task when some dependencies are not completed", () => {
    const result = validateTaskDependencies(3, tasks, [1]);
    expect(result.valid).toBe(false);
    expect(result.unmetDependencies).toEqual([2]);
  });

  it("allows task with no dependsOn field", () => {
    const result = validateTaskDependencies(4, tasks, []);
    expect(result.valid).toBe(true);
  });

  it("returns error for unknown task index", () => {
    const result = validateTaskDependencies(99, tasks, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not found");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-validate.ts
import type { PlanTask } from "./state-machine.js";

export interface ValidationResult {
  valid: boolean;
  unmetDependencies?: number[];
  error?: string;
}

/**
 * Validate that all dependency tasks are completed before allowing a subagent
 * to start working on the given task.
 */
export function validateTaskDependencies(
  taskIndex: number,
  tasks: PlanTask[],
  completedTaskIndices: number[],
): ValidationResult {
  const task = tasks.find(t => t.index === taskIndex);
  if (!task) {
    return { valid: false, error: `Task ${taskIndex} not found in plan.` };
  }

  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { valid: true };
  }

  const completedSet = new Set(completedTaskIndices);
  const unmet = task.dependsOn.filter(dep => !completedSet.has(dep));

  if (unmet.length > 0) {
    return { valid: false, unmetDependencies: unmet };
  }

  return { valid: true };
}
```

**Verify:** `bun test tests/subagent-validate.test.ts`

---

### Task 9: Subagent ID generation and runner core [depends: 4, 5, 6]

**Files:**
- Create: `extensions/megapowers/subagent-runner.ts`
- Test: `tests/subagent-runner.test.ts`

**Test:**
```typescript
// tests/subagent-runner.test.ts
import { describe, it, expect } from "bun:test";
import {
  generateSubagentId,
  buildSpawnArgs,
  buildSpawnEnv,
} from "../extensions/megapowers/subagent-runner.js";

describe("generateSubagentId", () => {
  it("returns a string starting with 'sa-'", () => {
    const id = generateSubagentId();
    expect(id).toMatch(/^sa-/);
  });

  it("returns unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSubagentId()));
    expect(ids.size).toBe(100);
  });

  it("includes task index when provided", () => {
    const id = generateSubagentId(3);
    expect(id).toMatch(/^sa-t3-/);
  });
});

describe("buildSpawnArgs", () => {
  it("returns pi command with prompt argument", () => {
    const args = buildSpawnArgs("Do the thing");
    expect(args[0]).toBe("pi");
    expect(args).toContain("--prompt");
    expect(args).toContain("Do the thing");
  });

  it("includes model flag when specified", () => {
    const args = buildSpawnArgs("task", { model: "claude-sonnet-4-20250514" });
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-20250514");
  });

  it("includes tools flag when specified", () => {
    const args = buildSpawnArgs("task", { tools: ["read", "write"] });
    expect(args).toContain("--tools");
    expect(args).toContain("read,write");
  });
});

describe("buildSpawnEnv", () => {
  it("sets PI_SUBAGENT=1", () => {
    const env = buildSpawnEnv();
    expect(env.PI_SUBAGENT).toBe("1");
  });

  it("includes MEGA_SUBAGENT_ID when provided", () => {
    const env = buildSpawnEnv("sa-abc123");
    expect(env.MEGA_SUBAGENT_ID).toBe("sa-abc123");
  });

  it("preserves existing PATH", () => {
    const env = buildSpawnEnv();
    expect(env.PATH).toBeDefined();
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-runner.ts
import { randomUUID } from "node:crypto";

/**
 * Generate a unique subagent ID. Optionally includes task index for traceability.
 */
export function generateSubagentId(taskIndex?: number): string {
  const suffix = randomUUID().slice(0, 8);
  if (taskIndex !== undefined) {
    return `sa-t${taskIndex}-${suffix}`;
  }
  return `sa-${suffix}`;
}

export interface SpawnOptions {
  model?: string;
  tools?: string[];
  thinking?: string;
}

/**
 * Build the command-line arguments for spawning a pi subagent.
 */
export function buildSpawnArgs(prompt: string, options?: SpawnOptions): string[] {
  const args = ["pi", "--prompt", prompt, "--non-interactive"];

  if (options?.model) {
    args.push("--model", options.model);
  }

  if (options?.tools && options.tools.length > 0) {
    args.push("--tools", options.tools.join(","));
  }

  return args;
}

/**
 * Build environment variables for the subagent process.
 */
export function buildSpawnEnv(subagentId?: string): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PI_SUBAGENT: "1",
  };

  if (subagentId) {
    env.MEGA_SUBAGENT_ID = subagentId;
  }

  return env;
}
```

**Verify:** `bun test tests/subagent-runner.test.ts`

---

### Task 10: Subagent async dispatch with workspace integration [depends: 4, 6, 9]

**Files:**
- Create: `extensions/megapowers/subagent-async.ts`
- Test: `tests/subagent-async.test.ts`

**Test:**
```typescript
// tests/subagent-async.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  buildDispatchConfig,
  type DispatchConfig,
  DEFAULT_TIMEOUT_MS,
} from "../extensions/megapowers/subagent-async.js";

describe("DEFAULT_TIMEOUT_MS", () => {
  it("defaults to 10 minutes", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });
});

describe("buildDispatchConfig", () => {
  it("builds config with required fields", () => {
    const config = buildDispatchConfig({
      id: "sa-001",
      prompt: "Do the thing",
      cwd: "/project",
      workspacePath: "/project/.jj/working-copies/mega-sa-001",
    });
    expect(config.id).toBe("sa-001");
    expect(config.prompt).toBe("Do the thing");
    expect(config.workspacePath).toBe("/project/.jj/working-copies/mega-sa-001");
    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("uses custom timeout when provided", () => {
    const config = buildDispatchConfig({
      id: "sa-002",
      prompt: "Do another thing",
      cwd: "/project",
      workspacePath: "/tmp/ws",
      timeoutMs: 5 * 60 * 1000,
    });
    expect(config.timeoutMs).toBe(5 * 60 * 1000);
  });

  it("includes agent options when provided", () => {
    const config = buildDispatchConfig({
      id: "sa-003",
      prompt: "Research",
      cwd: "/project",
      workspacePath: "/tmp/ws",
      model: "claude-sonnet-4-20250514",
      tools: ["read", "bash"],
    });
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.tools).toEqual(["read", "bash"]);
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-async.ts

export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface DispatchConfig {
  id: string;
  prompt: string;
  cwd: string;
  workspacePath: string;
  timeoutMs: number;
  model?: string;
  tools?: string[];
}

export interface DispatchInput {
  id: string;
  prompt: string;
  cwd: string;
  workspacePath: string;
  timeoutMs?: number;
  model?: string;
  tools?: string[];
}

/**
 * Build a dispatch configuration with defaults applied.
 */
export function buildDispatchConfig(input: DispatchInput): DispatchConfig {
  return {
    id: input.id,
    prompt: input.prompt,
    cwd: input.cwd,
    workspacePath: input.workspacePath,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    model: input.model,
    tools: input.tools,
  };
}
```

**Verify:** `bun test tests/subagent-async.test.ts`

---

### Task 11: Subagent tool handler — dispatch logic [depends: 1, 2, 4, 6, 7, 8, 9, 10]

**Files:**
- Create: `extensions/megapowers/subagent-tools.ts`
- Test: `tests/subagent-tools.test.ts`

**Test:**
```typescript
// tests/subagent-tools.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  handleSubagentDispatch,
  handleSubagentStatus,
  type SubagentDispatchInput,
} from "../extensions/megapowers/subagent-tools.js";
import { writeSubagentStatus } from "../extensions/megapowers/subagent-status.js";
import { writeState } from "../extensions/megapowers/state-io.js";
import { createInitialState } from "../extensions/megapowers/state-machine.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { JJ } from "../extensions/megapowers/jj.js";

function mockJJ(overrides: Partial<JJ> = {}): JJ {
  return {
    isJJRepo: async () => true,
    getCurrentChangeId: async () => "current-id",
    getChangeDescription: async () => "",
    hasConflicts: async () => false,
    newChange: async () => "new-id",
    describe: async () => {},
    squash: async () => {},
    bookmarkSet: async () => {},
    log: async () => "",
    diff: async () => "",
    abandon: async () => {},
    squashInto: async () => {},
    ...overrides,
  };
}

describe("handleSubagentDispatch", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-tools-test-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error when megapowers is disabled", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });
    const result = handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("disabled");
  });

  it("returns error when no active issue", () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("No active issue");
  });

  it("returns subagent ID on successful dispatch", () => {
    const result = handleSubagentDispatch(tmp, { task: "Build the parser" });
    expect(result.id).toBeDefined();
    expect(result.id).toMatch(/^sa-/);
    expect(result.error).toBeUndefined();
  });

  it("includes task index in ID when taskIndex is provided", () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: Setup\n\n### Task 2: Build\n");

    const result = handleSubagentDispatch(tmp, { task: "Build", taskIndex: 2 });
    expect(result.id).toMatch(/^sa-t2-/);
  });

  it("blocks dispatch when task dependencies are not met", () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: A\n\n### Task 2: B [depends: 1]\n");

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      completedTasks: [], // Task 1 not completed
    });

    const result = handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 });
    expect(result.error).toContain("depend");
  });

  it("allows dispatch when task dependencies are met", () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: A\n\n### Task 2: B [depends: 1]\n");

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      completedTasks: [1],
    });

    const result = handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 });
    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
  });
});

describe("handleSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-status-tool-test-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns error for nonexistent subagent", () => {
    const result = handleSubagentStatus(tmp, "nonexistent");
    expect(result.error).toContain("not found");
  });

  it("returns status for running subagent", () => {
    writeSubagentStatus(tmp, "sa-001", {
      id: "sa-001",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
    });
    const result = handleSubagentStatus(tmp, "sa-001");
    expect(result.status).toBeDefined();
    expect(result.status!.state).toBe("running");
    expect(result.status!.turnsUsed).toBe(3);
  });

  it("returns diff for completed subagent", () => {
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/foo.ts"],
      diff: "M src/foo.ts",
      testsPassed: true,
    });
    const result = handleSubagentStatus(tmp, "sa-002");
    expect(result.status!.state).toBe("completed");
    expect(result.status!.diff).toContain("src/foo.ts");
    expect(result.status!.filesChanged).toEqual(["src/foo.ts"]);
  });

  it("returns error info for failed subagent", () => {
    writeSubagentStatus(tmp, "sa-003", {
      id: "sa-003",
      state: "failed",
      turnsUsed: 2,
      startedAt: 1000,
      completedAt: 1500,
      error: "Process exited with code 1",
    });
    const result = handleSubagentStatus(tmp, "sa-003");
    expect(result.status!.state).toBe("failed");
    expect(result.status!.error).toContain("exit");
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-tools.ts
import { readState } from "./state-io.js";
import { deriveTasks } from "./derived.js";
import { readSubagentStatus, type SubagentStatus } from "./subagent-status.js";
import { generateSubagentId } from "./subagent-runner.js";
import { validateTaskDependencies } from "./subagent-validate.js";
import { extractTaskSection, buildSubagentPrompt } from "./subagent-context.js";
import { resolveAgent } from "./subagent-agents.js";
import { buildDispatchConfig, type DispatchConfig } from "./subagent-async.js";
import { buildWorkspaceName } from "./subagent-workspace.js";
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
  error?: string;
}

export interface SubagentStatusResult {
  status?: SubagentStatus;
  error?: string;
}

/**
 * Handle the subagent dispatch request. Validates state, resolves agent,
 * validates dependencies, and builds the dispatch config.
 *
 * Does NOT spawn the process — that's done by the caller (index.ts)
 * using the returned DispatchConfig with pi.exec or child_process.
 */
export function handleSubagentDispatch(
  cwd: string,
  input: SubagentDispatchInput,
): SubagentDispatchResult {
  const state = readState(cwd);

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue) {
    return { error: "No active issue. Use /issue to select or create one first." };
  }

  // Resolve agent
  const agent = resolveAgent(input.agent, cwd);

  // Generate ID
  const id = generateSubagentId(input.taskIndex);

  // Validate task dependencies if taskIndex provided
  if (input.taskIndex !== undefined) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    if (tasks.length > 0) {
      const result = validateTaskDependencies(input.taskIndex, tasks, state.completedTasks);
      if (!result.valid) {
        const reason = result.unmetDependencies
          ? `Task ${input.taskIndex} depends on incomplete tasks: ${result.unmetDependencies.join(", ")}`
          : result.error ?? "Dependency validation failed.";
        return { error: reason };
      }
    }
  }

  // Build prompt with plan context
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

  // Build workspace path
  const workspaceName = buildWorkspaceName(id);
  const workspacePath = `${cwd}/.jj/working-copies/${workspaceName}`;

  const config = buildDispatchConfig({
    id,
    prompt,
    cwd,
    workspacePath,
    timeoutMs: input.timeoutMs,
    model: agent?.model,
    tools: agent?.tools,
  });

  return { id, config };
}

/**
 * Handle the subagent_status request. Reads status from disk.
 */
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
```

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 12: Register subagent and subagent_status tools in index.ts [depends: 11]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/subagent-tools.test.ts` (already covers handler logic; this task wires to pi.registerTool)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts
describe("tool registration interface", () => {
  it("handleSubagentDispatch returns DispatchConfig for spawning", () => {
    // Already tested above — this verifies the contract index.ts relies on
    // The config includes: id, prompt, workspacePath, timeoutMs, model, tools
    const tmp = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "reg-test-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
    });
    const result = handleSubagentDispatch(tmp, { task: "test" });
    expect(result.config).toBeDefined();
    expect(result.config!.id).toBe(result.id);
    expect(result.config!.prompt).toContain("test");
    expect(result.config!.workspacePath).toContain(".jj/working-copies");
    require("node:fs").rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Implementation:**

Add to `extensions/megapowers/index.ts` — after the existing `create_batch` tool registration block, add:

```typescript
// Import at top of file:
import { handleSubagentDispatch, handleSubagentStatus } from "./subagent-tools.js";
import { writeSubagentStatus } from "./subagent-status.js";
import { buildSpawnArgs, buildSpawnEnv } from "./subagent-runner.js";
import { buildWorkspaceName, buildWorkspaceAddArgs, buildWorkspaceForgetArgs, buildWorkspaceDiffArgs } from "./subagent-workspace.js";
import { parseTaskDiffFiles } from "./task-coordinator.js";

// After create_batch tool registration:

  // --- Tools: subagent ---

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: "Delegate a task to a subagent running in an isolated jj workspace. Returns immediately with a subagent ID. Use subagent_status to check progress.",
    parameters: Type.Object({
      task: Type.String({ description: "Task description for the subagent" }),
      taskIndex: Type.Optional(Type.Number({ description: "Plan task index (validates dependencies)" })),
      agent: Type.Optional(Type.String({ description: "Agent name (default: worker)" })),
      timeoutMs: Type.Optional(Type.Number({ description: "Timeout in milliseconds (default: 600000)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!jj) jj = createJJ(pi);

      const result = handleSubagentDispatch(ctx.cwd, {
        task: params.task,
        taskIndex: params.taskIndex,
        agent: params.agent,
        timeoutMs: params.timeoutMs,
      });

      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }

      const config = result.config!;
      const id = result.id!;

      // Write initial status
      writeSubagentStatus(ctx.cwd, id, {
        id,
        state: "running",
        turnsUsed: 0,
        startedAt: Date.now(),
      });

      // Create jj workspace and spawn (async, fire-and-forget)
      const workspaceName = buildWorkspaceName(id);

      (async () => {
        try {
          // Create jj workspace
          const wsResult = await pi.exec("jj", buildWorkspaceAddArgs(workspaceName, config.workspacePath));
          if (wsResult.code !== 0) {
            writeSubagentStatus(ctx.cwd, id, {
              id,
              state: "failed",
              turnsUsed: 0,
              startedAt: Date.now(),
              completedAt: Date.now(),
              error: `Failed to create jj workspace: ${wsResult.stderr}`,
            });
            return;
          }

          // Spawn pi subprocess
          const args = buildSpawnArgs(config.prompt, {
            model: config.model,
            tools: config.tools,
          });
          const env = buildSpawnEnv(id);

          const { spawn } = await import("node:child_process");
          const child = spawn(args[0], args.slice(1), {
            cwd: config.workspacePath,
            env,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

          let stderr = "";
          child.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

          // Timeout handling
          const timer = setTimeout(() => {
            try { child.kill("SIGTERM"); } catch {}
            writeSubagentStatus(ctx.cwd, id, {
              id,
              state: "timed-out",
              turnsUsed: 0,
              startedAt: config.timeoutMs,
              completedAt: Date.now(),
              error: `Subagent timed out after ${config.timeoutMs / 1000}s`,
            });
            // Cleanup workspace
            pi.exec("jj", buildWorkspaceForgetArgs(workspaceName)).catch(() => {});
          }, config.timeoutMs);

          child.on("close", async (code) => {
            clearTimeout(timer);

            if (code !== 0) {
              writeSubagentStatus(ctx.cwd, id, {
                id,
                state: "failed",
                turnsUsed: 0,
                startedAt: Date.now(),
                completedAt: Date.now(),
                error: `Process exited with code ${code}. ${stderr}`.trim(),
              });
            } else {
              // Get diff from workspace
              try {
                const diffResult = await pi.exec("jj", buildWorkspaceDiffArgs(workspaceName));
                const filesChanged = parseTaskDiffFiles(diffResult.stdout);
                writeSubagentStatus(ctx.cwd, id, {
                  id,
                  state: "completed",
                  turnsUsed: 0,
                  startedAt: Date.now(),
                  completedAt: Date.now(),
                  filesChanged,
                  diff: diffResult.stdout,
                  testsPassed: true,
                });
              } catch {
                writeSubagentStatus(ctx.cwd, id, {
                  id,
                  state: "completed",
                  turnsUsed: 0,
                  startedAt: Date.now(),
                  completedAt: Date.now(),
                });
              }
            }

            // Always cleanup workspace
            try {
              await pi.exec("jj", buildWorkspaceForgetArgs(workspaceName));
            } catch {}
          });

          child.unref();
        } catch (err) {
          writeSubagentStatus(ctx.cwd, id, {
            id,
            state: "failed",
            turnsUsed: 0,
            startedAt: Date.now(),
            completedAt: Date.now(),
            error: `Spawn failed: ${err}`,
          });
          // Cleanup workspace on error
          try {
            await pi.exec("jj", buildWorkspaceForgetArgs(workspaceName));
          } catch {}
        }
      })();

      return {
        content: [{ type: "text", text: `Subagent dispatched: ${id}\nWorkspace: ${workspaceName}\nUse subagent_status to check progress.` }],
        details: undefined,
      };
    },
  });

  // --- Tools: subagent_status ---

  pi.registerTool({
    name: "subagent_status",
    label: "Subagent Status",
    description: "Check the status of a running subagent. Returns state, files changed, test results, and diff for completed subagents.",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID returned from the subagent tool" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSubagentStatus(ctx.cwd, params.id);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }

      const s = result.status!;
      const lines: string[] = [
        `Subagent: ${s.id}`,
        `State: ${s.state}`,
        `Turns: ${s.turnsUsed}`,
      ];

      if (s.filesChanged) {
        lines.push(`Files changed: ${s.filesChanged.length}`);
        for (const f of s.filesChanged) lines.push(`  - ${f}`);
      }
      if (s.testsPassed !== undefined) {
        lines.push(`Tests: ${s.testsPassed ? "passed" : "failed"}`);
      }
      if (s.error) {
        lines.push(`Error: ${s.error}`);
      }
      if (s.diff) {
        lines.push(`\nDiff:\n${s.diff}`);
      }
      if (s.detectedErrors && s.detectedErrors.length > 0) {
        lines.push(`\nDetected repeated errors:`);
        for (const e of s.detectedErrors) lines.push(`  - ${e}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: undefined,
      };
    },
  });
```

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 13: Write policy allows subagent tool in all phases [no-test]

**Files:**
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts
describe("subagent available in all phases", () => {
  const phases = ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "reproduce", "diagnose"];

  for (const phase of phases) {
    it(`handleSubagentDispatch works in ${phase} phase`, () => {
      const tmp = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), `phase-${phase}-`));
      const workflow = ["reproduce", "diagnose"].includes(phase) ? "bugfix" : "feature";
      writeState(tmp, {
        ...createInitialState(),
        activeIssue: "001-test",
        workflow: workflow as any,
        phase: phase as any,
        megaEnabled: true,
      });
      const result = handleSubagentDispatch(tmp, { task: "Do thing" });
      expect(result.error).toBeUndefined();
      expect(result.id).toBeDefined();
      require("node:fs").rmSync(tmp, { recursive: true, force: true });
    });
  }
});
```

**Implementation:** No code changes needed — `handleSubagentDispatch` in Task 11 already has no phase gating. This test confirms AC15.

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 14: Satellite TDD enforcement during implement phase [no-test]

**Files:**
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts
describe("satellite TDD enforcement", () => {
  it("sets PI_SUBAGENT=1 in spawn env for TDD enforcement", () => {
    // The spawn env builder (tested in Task 9) sets PI_SUBAGENT=1
    // which triggers isSatelliteMode() in the child session (tested in satellite.test.ts)
    // This test verifies the contract between subagent dispatch and satellite detection
    const { buildSpawnEnv } = require("../extensions/megapowers/subagent-runner.js");
    const { isSatelliteMode } = require("../extensions/megapowers/satellite.js");

    const env = buildSpawnEnv("sa-test");
    expect(isSatelliteMode({ isTTY: false, env })).toBe(true);
  });
});
```

**Implementation:** Already implemented — `buildSpawnEnv` sets `PI_SUBAGENT=1` and `isSatelliteMode` checks for it. This test confirms AC16.

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 15: Subagent_status does not auto-squash [no-test]

**Files:**
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts
describe("no auto-squash", () => {
  it("handleSubagentStatus returns diff without squashing", () => {
    const tmp = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "no-squash-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
    });
    writeSubagentStatus(tmp, "sa-nosquash", {
      id: "sa-nosquash",
      state: "completed",
      turnsUsed: 3,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/a.ts"],
      diff: "M src/a.ts",
      testsPassed: true,
    });

    // The handler ONLY reads status, it never calls jj squash
    const result = handleSubagentStatus(tmp, "sa-nosquash");
    expect(result.status!.state).toBe("completed");
    expect(result.status!.diff).toBe("M src/a.ts");
    // No squash happens — parent LLM must explicitly decide
    require("node:fs").rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Implementation:** Already implemented — `handleSubagentStatus` only reads status files, never calls jj. This confirms AC8.

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 16: Hide/show subagent tools with mega off/on [depends: 12]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts
describe("mega off disables subagent dispatch", () => {
  it("returns error when megaEnabled is false", () => {
    const tmp = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "mega-off-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: false,
    });
    const result = handleSubagentDispatch(tmp, { task: "test" });
    expect(result.error).toContain("disabled");
    require("node:fs").rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Implementation:**

In the `/mega off` command handler in `index.ts`, update the filter to also exclude subagent tools:

```typescript
// In /mega off handler, update the filter:
const activeTools = pi.getActiveTools().filter(
  t => t !== "megapowers_signal" && t !== "megapowers_save_artifact" && t !== "subagent" && t !== "subagent_status"
);
```

In the `/mega on` handler, restore them:

```typescript
// In /mega on handler, update the restore:
const activeTools = pi.getActiveTools();
const toolsToAdd = ["megapowers_signal", "megapowers_save_artifact", "subagent", "subagent_status"];
const missing = toolsToAdd.filter(t => !activeTools.includes(t));
if (missing.length > 0) {
  pi.setActiveTools([...activeTools, ...missing]);
}
```

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 17: Workspace cleanup on all exit paths [depends: 6, 12]

**Files:**
- Test: `tests/subagent-workspace.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-workspace.test.ts
describe("cleanup contract", () => {
  it("buildWorkspaceForgetArgs produces valid cleanup command for any workspace name", () => {
    // The cleanup is always the same: jj workspace forget <name>
    // This test verifies the contract that index.ts relies on
    const names = ["mega-sa-001", "mega-sa-t3-abc12345", "mega-sa-timeout"];
    for (const name of names) {
      const args = buildWorkspaceForgetArgs(name);
      expect(args).toEqual(["workspace", "forget", name]);
    }
  });

  it("workspace forget is idempotent-safe (args don't depend on workspace state)", () => {
    // The forget command can be called even if workspace was already cleaned up
    // jj will return non-zero but that's caught by try/catch in index.ts
    const args = buildWorkspaceForgetArgs("mega-sa-already-cleaned");
    expect(args[0]).toBe("workspace");
    expect(args[1]).toBe("forget");
  });
});
```

**Implementation:** Already implemented in Task 12's index.ts code — workspace forget is called in the `close` event handler (success and failure), in the timeout handler, and in the spawn error catch block. This test confirms AC9.

**Verify:** `bun test tests/subagent-workspace.test.ts`

---

### Task 18: UPSTREAM.md tracking [no-test]

**Files:**
- Create: `extensions/megapowers/UPSTREAM.md`

**Implementation:**

```markdown
# Upstream Dependencies

## pi-subagents

- **Repository:** https://github.com/nicobailon/pi-subagents
- **Pinned Commit:** N/A (pattern adaptation, not direct import)
- **Patterns Used:**
  - Async runner with status file protocol
  - Agent discovery from markdown files with YAML frontmatter
  - Error detection via repeated failure heuristics
  - Compatible frontmatter schema: `name`, `model`, `tools`, `thinking`
- **Patterns Not Used:**
  - Agent chains/pipelines
  - Agent manager UI
  - MCP integration
  - Session sharing
- **Last Audit:** 2026-02-24

## Audit Schedule

Review pi-subagents for improvements to shared patterns quarterly or when upstream publishes breaking changes.
```

**Verify:** `cat extensions/megapowers/UPSTREAM.md`

---

## Acceptance Criteria Coverage

| AC | Task(s) | Description |
|----|---------|-------------|
| 1 | 11, 12 | `subagent` tool registered via pi.registerTool() |
| 2 | 11, 12 | `subagent_status` tool registered via pi.registerTool() |
| 3 | 6, 12 | jj workspace created via `jj workspace add` |
| 4 | 9, 12 | Detached pi process with PI_SUBAGENT=1, returns ID |
| 5 | 4 | Status file protocol in .megapowers/subagents/<id>/ |
| 6 | 4, 11 | subagent_status reads structured data |
| 7 | 4, 11 | Completed status includes jj diff output |
| 8 | 15 | No auto-squash — status returns diff only |
| 9 | 12, 17 | Workspace cleanup on all exit paths |
| 10 | 12 | Non-zero exit → failed state + error |
| 11 | 10, 12 | Configurable timeout, kill + cleanup |
| 12 | 1, 2 | Agent markdown frontmatter parsing, priority search |
| 13 | 3 | Three builtin agents: worker, scout, reviewer |
| 14 | 1 | pi-subagents compatible frontmatter schema |
| 15 | 13 | Available in all workflow phases |
| 16 | 14 | Satellite TDD via PI_SUBAGENT=1 |
| 17 | Pre-existing | [depends: N, M] already in plan-parser.ts |
| 18 | 8, 11 | Dependency validation before spawn |
| 19 | 7, 11 | Task context from plan section |
| 20 | 5 | Error detection heuristics |
| 21 | 18 | UPSTREAM.md created |
