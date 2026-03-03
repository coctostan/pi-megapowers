# Plan: Subagent Implementation Reliability (Revised)

## Summary

Build `subagent` and `subagent_status` tools within megapowers, using jj workspace isolation and an async status file protocol. 15 tasks covering: agent frontmatter parsing, builtin agents, agent discovery, status protocol with merge semantics, error detection, jj workspace lifecycle, task context assembly, JSONL runner (correct event types), dependency validation, async dispatch config, subagent tool handlers, project-root resolution for satellite TDD, tool registration + wiring, mega off/on, and upstream tracking.

**AC17 is pre-existing** — `[depends: N, M]` parsing already exists in `plan-parser.ts` with full test coverage. No task needed.

**AC5 interpretation (CONFIRMED)**: The spec says "spawned pi subprocess writes status.json". In this plan, the **parent/supervisor** writes and updates `status.json` by parsing the child's JSONL stdout stream. The child subprocess has no awareness of the status file. This is the correct architecture because: (a) the child runs with `--mode json` outputting JSONL events, not status files; (b) the parent can detect timeout/crash conditions the child can't report; (c) it avoids competing file writes between parent and child. **Reviewer confirmed this satisfies AC5** — "the subagent system produces status.json" is the correct reading.

### Review feedback addressed (rounds 1-4)

#### Round 1
- **Task ordering**: Builtin agents (Task 2) now precede agent discovery (Task 3) so fallback tests pass.
- **pi CLI flags**: Uses `--mode json -p --no-session` matching the upstream pi subagent example, not `--non-interactive`.
- **Workspace path**: Uses `.megapowers/subagents/<id>/workspace` instead of hardcoded `.jj/working-copies/`.
- **SIGTERM→SIGKILL escalation**: 5-second escalation timer after SIGTERM, matching pi example pattern.
- **jj-required guard**: `handleSubagentDispatch` checks `isJJRepo()` and returns clear error if false.
- **UPSTREAM.md**: Pinned to commit `1281c04`.

#### Round 2
- **AC5 `phase` field**: Added `phase?: string` to `SubagentStatus`. Initial and all running status updates preserve phase.
- **Agent system prompt applied**: Writes `agent.systemPrompt` to disk and passes via `--append-system-prompt`.
- **Agent `thinking` forwarded**: `buildSpawnArgs()` supports `--thinking <level>` flag.
- **`resolveAgent()` robustness**: Continues searching when a file has invalid frontmatter.

#### Round 3
- **AC16 satellite TDD enforcement (BLOCKING)**: New Task 12 adds `MEGA_PROJECT_ROOT` env var to `buildSpawnEnv()` and modifies satellite mode in `index.ts` to read state from project root, not workspace cwd. Without this, subagent workspace dirs have no `.megapowers/state.json` and `canWrite()` becomes pass-through.
- **AC7 full diff for review (BLOCKING)**: Task 13 runs both `jj diff --summary` (→ `filesChanged`) AND `jj diff` (→ `diff` field with full patch). If full diff exceeds 100KB, stores to `diff.patch` file and references it.
- **JSONL event types fixed (BLOCKING)**: Task 8 now uses `tool_execution_end` (with `toolName`, `result`, `isError`) for error/test detection, and `message_end` with `message.role === "assistant"` for turn counting AND assistant-text error harvesting (AC20). Removed references to nonexistent `tool_result_end` event.
- **AC20 error detection from assistant messages**: `processJsonlLine()` now harvests errors from both `tool_execution_end` results AND `message_end` assistant text content.
- **Scout.md tools fixed**: Removed `web_search` and `fetch_content` (not pi built-in tools). Scout now uses `read, bash` only.
- **CLI prompt length risk fixed**: Prompt is written to `.megapowers/subagents/<id>/prompt.md` and passed as `@prompt.md` file arg, avoiding OS command-line length limits.
- **Status merge semantics**: Task 4 adds `updateSubagentStatus()` that reads existing status and merges with a partial update, preserving fields like `phase`. Terminal states (completed/failed/timed-out) refuse overwrites.
- **Dependency validation when plan missing**: Task 9 now returns error when `taskIndex` is provided but plan tasks can't be derived (empty plan or missing file).
- **Timeout/cleanup race fixed**: Timeout handler only sets `isTerminal` flag and kills the process. All workspace cleanup happens in the `close` handler after process exit, regardless of exit path (success, failure, timeout).
- **AC5/AC6/AC7 output format**: `subagent_status` returns JSON as tool content for machine-safe LLM parsing. Human-readable summary is secondary.

#### Round 4
- **Task 1 frontmatter YAML arrays (BLOCKING)**: `parseAgentFrontmatter()` now supports multiline YAML `- item` arrays for tools field, not just inline `[a, b]` and `a, b` formats. New test covers this.
- **Task 4 atomic status writes (RECOMMENDED)**: `writeSubagentStatus()` now uses atomic temp-file-then-rename (same pattern as `state-io.ts`) to prevent `readSubagentStatus()` from reading partial JSON during concurrent writes.
- **Task 8 isTestCommand gating (RECOMMENDED)**: Test result detection in `processJsonlLine()` now gates on `isTestCommand(command)` from the correlated `tool_execution_start` args, preventing false positives from non-test bash commands that happen to contain "pass"/"fail" strings.
- **Task 13 pi.exec cwd support (BLOCKING)**: Confirmed `pi.exec()` supports `ExecOptions.cwd` per the pi SDK type definitions (`exec(command, args, options?: ExecOptions)`). Task 13 now uses `pi.exec("jj", args, { cwd: config.workspacePath })` directly for workspace-scoped jj commands. Does NOT go through `createJJ()` wrapper (which doesn't pass options through).
- **AC5 clarification**: Explicitly documented that parent/supervisor writes status from JSONL stream parsing, not the child subprocess.

---

### Task 1: Agent frontmatter parsing

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
    expect(agent!.name).toBe("scout");
    expect(agent!.model).toBeUndefined();
    expect(agent!.tools).toBeUndefined();
    expect(agent!.thinking).toBeUndefined();
    expect(agent!.systemPrompt).toBe("Scout agent.");
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

  it("parses tools as multiline YAML dash-item array", () => {
    const md = `---
name: helper
tools:
  - read
  - write
  - bash
---

Helper agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write", "bash"]);
    expect(agent!.name).toBe("helper");
    expect(agent!.systemPrompt).toBe("Helper agent.");
  });

  it("parses tools as multiline YAML dash-item with other fields after", () => {
    const md = `---
name: worker
tools:
  - read
  - bash
thinking: full
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "bash"]);
    expect(agent!.thinking).toBe("full");
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

  it("returns null when name field is missing", () => {
    const md = `---
model: some-model
---

No name.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent).toBeNull();
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
    // Check for "- item" continuation of a multiline array
    const dashItem = line.match(/^\s+-\s+(.+)$/);
    if (dashItem && currentArrayKey) {
      if (!multilineArrays[currentArrayKey]) multilineArrays[currentArrayKey] = [];
      multilineArrays[currentArrayKey].push(dashItem[1].trim());
      continue;
    }

    // Check for "key: value" or "key:" (empty value, start of multiline array)
    const kvWithValue = line.match(/^(\w+):\s+(.+)$/);
    const kvEmpty = line.match(/^(\w+):\s*$/);

    if (kvWithValue) {
      currentArrayKey = null;
      data[kvWithValue[1]] = kvWithValue[2].trim();
    } else if (kvEmpty) {
      // Could be start of a multiline array (e.g., "tools:")
      currentArrayKey = kvEmpty[1];
    } else {
      currentArrayKey = null;
    }
  }

  if (!data.name) return null;

  const agent: AgentDef = { name: data.name };
  if (data.model) agent.model = data.model;
  if (data.thinking) agent.thinking = data.thinking;

  // Resolve tools: prefer multiline array if present, otherwise parse inline
  if (multilineArrays.tools && multilineArrays.tools.length > 0) {
    agent.tools = multilineArrays.tools;
  } else if (data.tools) {
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

### Task 2: Builtin agent files

**Files:**
- Create: `agents/worker.md`
- Create: `agents/scout.md`
- Create: `agents/reviewer.md`

**Test:**
```typescript
// tests/subagent-agents.test.ts — append to existing file
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisTestDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(thisTestDir, "..", "agents");

describe("builtin agent files", () => {
  it("worker.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).toBeDefined();
    expect(agent!.tools).toBeDefined();
    expect(agent!.systemPrompt).toBeDefined();
  });

  it("scout.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("scout");
    // scout uses only pi-supported tools
    expect(agent!.tools).toEqual(["read", "bash"]);
  });

  it("reviewer.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("reviewer");
  });
});
```

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
tools: [read, bash]
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

Note: scout uses only `read, bash` — not `web_search` or `fetch_content`, which are not pi built-in tools. If web search is needed in the future, it would require a separate pi extension providing those tools.

**Verify:** `bun test tests/subagent-agents.test.ts`

---

### Task 3: Agent discovery with priority search [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/subagent-agents.ts`
- Test: `tests/subagent-agents.test.ts` (append)

**Test:**
```typescript
// tests/subagent-agents.test.ts — append to existing file
import { resolveAgent, BUILTIN_AGENTS_DIR } from "../extensions/megapowers/subagent-agents.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";

describe("resolveAgent", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agent-resolve-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("finds agent in project .megapowers/agents/ directory", () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: fast-model\n---\nProject worker.`);

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
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: custom-model\n---\nCustom.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent!.model).toBe("custom-model");
  });

  it("uses default worker agent when no agent name specified", () => {
    const agent = resolveAgent(undefined, tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
  });

  it("searches user home directory between project and builtin", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "agent-home-test-"));
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(userAgentsDir, { recursive: true });
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome worker.`);

    const agent = resolveAgent("worker", tmp, fakeHome);
    expect(agent).not.toBeNull();
    expect(agent!.model).toBe("home-model");

    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("skips files with invalid frontmatter and continues search", () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nmodel: broken\n---\nNo name field.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).not.toBe("broken");
  });

  it("project agent takes priority over user home agent", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "agent-home-test-"));
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(userAgentsDir, { recursive: true });
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome.`);

    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: project-model\n---\nProject.`);

    const agent = resolveAgent("worker", tmp, fakeHome);
    expect(agent!.model).toBe("project-model");

    rmSync(fakeHome, { recursive: true, force: true });
  });
});
```

**Implementation:**
```typescript
// Add to extensions/megapowers/subagent-agents.ts
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const thisDir = dirname(fileURLToPath(import.meta.url));
export const BUILTIN_AGENTS_DIR = join(thisDir, "..", "..", "agents");

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
        continue; // invalid frontmatter, try next directory
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

### Task 4: Subagent status types, file protocol, and merge semantics

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
  updateSubagentStatus,
  subagentDir,
  type SubagentState,
  type SubagentStatus,
} from "../extensions/megapowers/subagent-status.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
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

  it("overwrites status entirely", () => {
    writeSubagentStatus(tmp, "sa-002", {
      id: "sa-002",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
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
    // phase was NOT in the second write, so it should be absent
    expect(read!.phase).toBeUndefined();
  });

  it("returns null when status file does not exist", () => {
    expect(readSubagentStatus(tmp, "nonexistent")).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    const dir = join(tmp, ".megapowers", "subagents", "corrupt");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "status.json"), "not json");
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
      diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new",
      testsPassed: true,
    };
    writeSubagentStatus(tmp, "sa-004", status);
    const read = readSubagentStatus(tmp, "sa-004");
    expect(read!.diff).toContain("src/a.ts");
  });

  it("includes phase field for running subagent", () => {
    const status: SubagentStatus = {
      id: "sa-006",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
    };
    writeSubagentStatus(tmp, "sa-006", status);
    const read = readSubagentStatus(tmp, "sa-006");
    expect(read!.phase).toBe("implement");
  });

  it("includes detectedErrors field", () => {
    const status: SubagentStatus = {
      id: "sa-005",
      state: "failed",
      turnsUsed: 6,
      startedAt: 1000,
      completedAt: 3000,
      detectedErrors: ["TypeError: x is not a function"],
    };
    writeSubagentStatus(tmp, "sa-005", status);
    const read = readSubagentStatus(tmp, "sa-005");
    expect(read!.detectedErrors).toEqual(["TypeError: x is not a function"]);
  });

  it("includes diffPath for large diffs", () => {
    const status: SubagentStatus = {
      id: "sa-007",
      state: "completed",
      turnsUsed: 3,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/big.ts"],
      diffPath: ".megapowers/subagents/sa-007/diff.patch",
      testsPassed: true,
    };
    writeSubagentStatus(tmp, "sa-007", status);
    const read = readSubagentStatus(tmp, "sa-007");
    expect(read!.diffPath).toBe(".megapowers/subagents/sa-007/diff.patch");
  });
});

describe("updateSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-update-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("merges partial update with existing status", () => {
    writeSubagentStatus(tmp, "sa-merge", {
      id: "sa-merge",
      state: "running",
      turnsUsed: 1,
      startedAt: 1000,
      phase: "implement",
    });
    updateSubagentStatus(tmp, "sa-merge", { turnsUsed: 5 });
    const read = readSubagentStatus(tmp, "sa-merge");
    expect(read!.turnsUsed).toBe(5);
    expect(read!.phase).toBe("implement"); // preserved
    expect(read!.state).toBe("running"); // preserved
  });

  it("refuses to overwrite terminal state", () => {
    writeSubagentStatus(tmp, "sa-terminal", {
      id: "sa-terminal",
      state: "completed",
      turnsUsed: 5,
      startedAt: 1000,
      completedAt: 2000,
    });
    const updated = updateSubagentStatus(tmp, "sa-terminal", { state: "running", turnsUsed: 6 });
    expect(updated).toBe(false);
    const read = readSubagentStatus(tmp, "sa-terminal");
    expect(read!.state).toBe("completed");
    expect(read!.turnsUsed).toBe(5);
  });

  it("allows transition TO terminal state", () => {
    writeSubagentStatus(tmp, "sa-finish", {
      id: "sa-finish",
      state: "running",
      turnsUsed: 3,
      startedAt: 1000,
      phase: "implement",
    });
    const updated = updateSubagentStatus(tmp, "sa-finish", {
      state: "completed",
      completedAt: 2000,
      turnsUsed: 5,
    });
    expect(updated).toBe(true);
    const read = readSubagentStatus(tmp, "sa-finish");
    expect(read!.state).toBe("completed");
    expect(read!.phase).toBe("implement"); // still preserved
    expect(read!.turnsUsed).toBe(5);
  });

  it("returns false when no existing status to merge with", () => {
    const updated = updateSubagentStatus(tmp, "sa-missing", { turnsUsed: 1 });
    expect(updated).toBe(false);
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-status.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type SubagentState = "running" | "completed" | "failed" | "timed-out";

const TERMINAL_STATES: ReadonlySet<SubagentState> = new Set(["completed", "failed", "timed-out"]);

export interface SubagentStatus {
  id: string;
  state: SubagentState;
  turnsUsed: number;
  startedAt: number;
  completedAt?: number;
  phase?: string;
  filesChanged?: string[];
  diff?: string;
  diffPath?: string;
  testsPassed?: boolean;
  error?: string;
  detectedErrors?: string[];
}

export function subagentDir(cwd: string, id: string): string {
  return join(cwd, ".megapowers", "subagents", id);
}

/**
 * Write status.json atomically using temp-file-then-rename.
 * Same pattern as state-io.ts writeState() — prevents readSubagentStatus()
 * from seeing partial JSON during concurrent writes from the JSONL stream handler.
 */
export function writeSubagentStatus(cwd: string, id: string, status: SubagentStatus): void {
  const dir = subagentDir(cwd, id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "status.json");
  const tmpPath = join(dir, `.status-${randomUUID().slice(0, 8)}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(status, null, 2) + "\n");
  renameSync(tmpPath, filePath);
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

/**
 * Merge a partial update into the existing status.
 * Preserves existing fields not present in the patch.
 * Refuses to overwrite terminal states (completed/failed/timed-out).
 * Returns true if the update was applied, false if refused or no existing status.
 */
export function updateSubagentStatus(
  cwd: string,
  id: string,
  patch: Partial<SubagentStatus>,
): boolean {
  const existing = readSubagentStatus(cwd, id);
  if (!existing) return false;

  // If already terminal, refuse any updates
  if (TERMINAL_STATES.has(existing.state)) return false;

  const merged: SubagentStatus = { ...existing, ...patch };
  writeSubagentStatus(cwd, id, merged);
  return true;
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
  buildWorkspaceSquashArgs,
  buildDiffSummaryArgs,
  buildDiffFullArgs,
  workspacePath,
} from "../extensions/megapowers/subagent-workspace.js";

describe("buildWorkspaceName", () => {
  it("creates workspace name from subagent ID", () => {
    expect(buildWorkspaceName("sa-abc123")).toBe("mega-sa-abc123");
  });
});

describe("workspacePath", () => {
  it("returns path under .megapowers/subagents/<id>/workspace", () => {
    expect(workspacePath("/project", "sa-abc")).toBe("/project/.megapowers/subagents/sa-abc/workspace");
  });
});

describe("buildWorkspaceAddArgs", () => {
  it("returns jj workspace add args with name and target path", () => {
    const args = buildWorkspaceAddArgs("mega-sa-abc", "/project/.megapowers/subagents/sa-abc/workspace");
    expect(args).toEqual(["workspace", "add", "--name", "mega-sa-abc", "/project/.megapowers/subagents/sa-abc/workspace"]);
  });
});

describe("buildWorkspaceForgetArgs", () => {
  it("returns jj workspace forget args", () => {
    expect(buildWorkspaceForgetArgs("mega-sa-abc")).toEqual(["workspace", "forget", "mega-sa-abc"]);
  });
});

describe("buildWorkspaceSquashArgs", () => {
  it("returns jj squash args from workspace into current change", () => {
    expect(buildWorkspaceSquashArgs("mega-sa-abc")).toEqual(["squash", "--from", "mega-sa-abc@"]);
  });
});

describe("buildDiffSummaryArgs", () => {
  it("returns jj diff --summary args", () => {
    expect(buildDiffSummaryArgs()).toEqual(["diff", "--summary"]);
  });
});

describe("buildDiffFullArgs", () => {
  it("returns jj diff args for full patch", () => {
    expect(buildDiffFullArgs()).toEqual(["diff"]);
  });
});

describe("cleanup contract", () => {
  it("buildWorkspaceForgetArgs produces valid cleanup command for any workspace name", () => {
    const names = ["mega-sa-001", "mega-sa-t3-abc12345", "mega-sa-timeout"];
    for (const name of names) {
      const args = buildWorkspaceForgetArgs(name);
      expect(args).toEqual(["workspace", "forget", name]);
    }
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-workspace.ts
import { join } from "node:path";

/**
 * Pure functions for jj workspace command construction.
 * No I/O — composed by the runner with pi.exec.
 */

export function buildWorkspaceName(subagentId: string): string {
  return `mega-${subagentId}`;
}

/**
 * Workspace directory under .megapowers/subagents/<id>/workspace.
 */
export function workspacePath(cwd: string, subagentId: string): string {
  return join(cwd, ".megapowers", "subagents", subagentId, "workspace");
}

export function buildWorkspaceAddArgs(workspaceName: string, targetPath: string): string[] {
  return ["workspace", "add", "--name", workspaceName, targetPath];
}

export function buildWorkspaceForgetArgs(workspaceName: string): string[] {
  return ["workspace", "forget", workspaceName];
}

export function buildWorkspaceSquashArgs(workspaceName: string): string[] {
  return ["squash", "--from", `${workspaceName}@`];
}

/** Build args for `jj diff --summary` (file list only). */
export function buildDiffSummaryArgs(): string[] {
  return ["diff", "--summary"];
}

/** Build args for `jj diff` (full patch output). */
export function buildDiffFullArgs(): string[] {
  return ["diff"];
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
import { describe, it, expect } from "bun:test";
import {
  extractTaskSection,
  buildSubagentPrompt,
} from "../extensions/megapowers/subagent-context.js";

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

### Task 8: JSONL runner — correct event parsing with tool_execution_end and assistant error harvesting [depends: 4, 5]

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
  processJsonlLine,
  type RunnerState,
  createRunnerState,
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
  it("returns pi args with JSON mode, prompt file arg, and no-session", () => {
    const args = buildSpawnArgs("/tmp/prompt.md");
    expect(args[0]).toBe("pi");
    expect(args).toContain("--mode");
    expect(args).toContain("json");
    expect(args).toContain("-p");
    expect(args).toContain("--no-session");
    // Prompt passed as @file reference to avoid CLI length limits
    expect(args[args.length - 1]).toBe("@/tmp/prompt.md");
  });

  it("includes model flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { model: "claude-sonnet-4-20250514" });
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-20250514");
  });

  it("includes tools flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { tools: ["read", "write"] });
    expect(args).toContain("--tools");
    expect(args).toContain("read,write");
  });

  it("includes append-system-prompt when systemPromptPath provided", () => {
    const args = buildSpawnArgs("/tmp/p.md", { systemPromptPath: "/tmp/system.md" });
    expect(args).toContain("--append-system-prompt");
    expect(args).toContain("/tmp/system.md");
  });

  it("includes thinking flag when specified", () => {
    const args = buildSpawnArgs("/tmp/p.md", { thinking: "full" });
    expect(args).toContain("--thinking");
    expect(args).toContain("full");
  });
});

describe("buildSpawnEnv", () => {
  it("sets PI_SUBAGENT=1", () => {
    const env = buildSpawnEnv();
    expect(env.PI_SUBAGENT).toBe("1");
  });

  it("includes MEGA_SUBAGENT_ID when provided", () => {
    const env = buildSpawnEnv({ subagentId: "sa-abc123" });
    expect(env.MEGA_SUBAGENT_ID).toBe("sa-abc123");
  });

  it("includes MEGA_PROJECT_ROOT when provided", () => {
    const env = buildSpawnEnv({ subagentId: "sa-abc", projectRoot: "/project" });
    expect(env.MEGA_PROJECT_ROOT).toBe("/project");
  });

  it("preserves existing PATH", () => {
    const env = buildSpawnEnv();
    expect(env.PATH).toBeDefined();
  });
});

describe("createRunnerState", () => {
  it("initializes with zero turns and empty errors", () => {
    const state = createRunnerState("sa-001", Date.now());
    expect(state.turnsUsed).toBe(0);
    expect(state.errorLines).toEqual([]);
    expect(state.isTerminal).toBe(false);
    expect(state.pendingToolCalls).toEqual(new Map());
  });
});

describe("processJsonlLine", () => {
  it("increments turns on assistant message_end", () => {
    const state = createRunnerState("sa-001", 1000);
    const event = JSON.stringify({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
    });
    processJsonlLine(state, event);
    expect(state.turnsUsed).toBe(1);
  });

  it("does not increment turns on toolResult message_end", () => {
    const state = createRunnerState("sa-001", 1000);
    const event = JSON.stringify({
      type: "message_end",
      message: { role: "toolResult", content: [{ type: "text", text: "ok" }] },
    });
    processJsonlLine(state, event);
    expect(state.turnsUsed).toBe(0);
  });

  it("tracks tool_execution_start to map toolCallId to toolName and args", () => {
    const state = createRunnerState("sa-001", 1000);
    const event = JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "bash",
      args: { command: "bun test" },
    });
    processJsonlLine(state, event);
    expect(state.pendingToolCalls.get("tc-1")).toEqual({ toolName: "bash", args: { command: "bun test" } });
  });

  it("detects test runner results from tool_execution_end on bash test commands", () => {
    const state = createRunnerState("sa-001", 1000);
    // First, register the bash tool call with a test runner command
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "bash",
      args: { command: "bun test tests/foo.test.ts" },
    }));
    // Then, receive the result
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "bash",
      result: { content: [{ type: "text", text: "42 pass\n0 fail\n" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBe(true);
  });

  it("detects failing tests from tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-2",
      toolName: "bash",
      args: { command: "bun test" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-2",
      toolName: "bash",
      result: { content: [{ type: "text", text: "10 pass\n3 fail\n" }] },
      isError: false,
    }));
    expect(state.lastTestPassed).toBe(false);
  });

  it("does not detect test results from non-test bash commands containing pass/fail strings", () => {
    const state = createRunnerState("sa-001", 1000);
    // A bash command that isn't a test runner but contains "pass"/"fail" strings
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-grep",
      toolName: "bash",
      args: { command: "grep -r 'password' src/" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-grep",
      toolName: "bash",
      result: { content: [{ type: "text", text: "src/auth.ts: const password = '3 pass'\nsrc/config.ts: 0 fail" }] },
      isError: false,
    }));
    // Should NOT detect as test results — the command is grep, not a test runner
    expect(state.lastTestPassed).toBeUndefined();
  });

  it("collects error lines from tool_execution_end results", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-3",
      toolName: "bash",
      result: { content: [{ type: "text", text: "Error: TypeError: x is not a function" }] },
      isError: true,
    }));
    expect(state.errorLines).toHaveLength(1);
    expect(state.errorLines[0].text).toContain("TypeError");
  });

  it("collects error lines from assistant message text (AC20)", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I see the error: TypeError: x is not a function. Let me try again." }],
      },
    }));
    expect(state.errorLines).toHaveLength(1);
    expect(state.errorLines[0].text).toContain("TypeError");
  });

  it("cleans up pending tool calls on tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "read",
      args: { path: "foo.ts" },
    }));
    expect(state.pendingToolCalls.size).toBe(1);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "read",
      result: { content: [{ type: "text", text: "file contents" }] },
      isError: false,
    }));
    expect(state.pendingToolCalls.size).toBe(0);
  });

  it("ignores invalid JSON lines", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, "not json at all");
    expect(state.turnsUsed).toBe(0);
  });

  it("ignores empty lines", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, "");
    processJsonlLine(state, "   ");
    expect(state.turnsUsed).toBe(0);
  });

  it("does not detect test results from non-bash tool_execution_end", () => {
    const state = createRunnerState("sa-001", 1000);
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_start",
      toolCallId: "tc-1",
      toolName: "read",
      args: { path: "tests/foo.test.ts" },
    }));
    processJsonlLine(state, JSON.stringify({
      type: "tool_execution_end",
      toolCallId: "tc-1",
      toolName: "read",
      result: { content: [{ type: "text", text: "42 pass\n0 fail\n" }] },
      isError: false,
    }));
    // read tool should not trigger test detection
    expect(state.lastTestPassed).toBeUndefined();
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-runner.ts
import { randomUUID } from "node:crypto";
import type { MessageLine } from "./subagent-errors.js";

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
  systemPromptPath?: string;
}

/**
 * Build the command-line arguments for spawning a pi subagent.
 * Uses --mode json -p --no-session to match upstream pi subagent example.
 *
 * The prompt is passed as @file reference (not inline text) to avoid OS
 * command-line length limits on large prompts.
 */
export function buildSpawnArgs(promptFilePath: string, options?: SpawnOptions): string[] {
  const args = ["pi", "--mode", "json", "-p", "--no-session"];

  if (options?.model) {
    args.push("--model", options.model);
  }

  if (options?.tools && options.tools.length > 0) {
    args.push("--tools", options.tools.join(","));
  }

  if (options?.thinking) {
    args.push("--thinking", options.thinking);
  }

  if (options?.systemPromptPath) {
    args.push("--append-system-prompt", options.systemPromptPath);
  }

  // Pass prompt as @file reference to avoid CLI length limits
  args.push(`@${promptFilePath}`);

  return args;
}

export interface SpawnEnvOptions {
  subagentId?: string;
  projectRoot?: string;
}

/**
 * Build environment variables for the subagent process.
 * Sets PI_SUBAGENT=1 for satellite mode detection.
 * Sets MEGA_PROJECT_ROOT so satellite can find the real .megapowers/state.json.
 */
export function buildSpawnEnv(options?: SpawnEnvOptions): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PI_SUBAGENT: "1",
  };

  if (options?.subagentId) {
    env.MEGA_SUBAGENT_ID = options.subagentId;
  }

  if (options?.projectRoot) {
    env.MEGA_PROJECT_ROOT = options.projectRoot;
  }

  return env;
}

/** Tracked info about a pending tool call. */
interface PendingToolCall {
  toolName: string;
  args: Record<string, any>;
}

/**
 * Mutable state tracked during JSONL streaming from a pi subprocess.
 */
export interface RunnerState {
  id: string;
  startedAt: number;
  turnsUsed: number;
  errorLines: MessageLine[];
  lastTestPassed: boolean | undefined;
  isTerminal: boolean;
  /** Track tool_execution_start → tool_execution_end for bash test detection. */
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
    pendingToolCalls: new Map(),
  };
}

// Pattern to detect test runner output (bun test, jest, vitest, etc.)
const TEST_PASS_PATTERN = /(\d+)\s+pass/i;
const TEST_FAIL_PATTERN = /(\d+)\s+fail/i;
const ERROR_LINE_PATTERN = /Error:|TypeError:|ReferenceError:|SyntaxError:|ENOENT:/i;

// Patterns indicating a bash command is a test runner
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

/**
 * Extract text content from a tool result's content array.
 */
function extractResultText(result: any): string {
  if (!result?.content || !Array.isArray(result.content)) return "";
  return result.content
    .filter((c: any) => c.type === "text" && c.text)
    .map((c: any) => c.text)
    .join("\n");
}

/**
 * Process a single JSONL line from the pi subprocess stdout.
 * Updates RunnerState in place: turn counts, error detection, test results.
 *
 * Parses these pi JSON-mode event types:
 * - message_end (role=assistant): count turns, harvest errors from text
 * - tool_execution_start: track toolCallId → {toolName, args}
 * - tool_execution_end: detect errors and test results (correlate with start event)
 */
export function processJsonlLine(state: RunnerState, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  let event: any;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return;
  }

  // Count turns and harvest errors from assistant message text (AC20)
  if (event.type === "message_end" && event.message?.role === "assistant") {
    state.turnsUsed++;

    // Check assistant text for error patterns
    const content = event.message.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "text" && part.text && ERROR_LINE_PATTERN.test(part.text)) {
          // Extract just the error line, not full assistant text
          const errorMatch = part.text.match(/(?:Error|TypeError|ReferenceError|SyntaxError|ENOENT):[^\n]*/i);
          if (errorMatch) {
            state.errorLines.push({ type: "error", text: errorMatch[0].slice(0, 200) });
          }
        }
      }
    }
  }

  // Track tool execution start → map toolCallId to {toolName, args}
  if (event.type === "tool_execution_start" && event.toolCallId) {
    state.pendingToolCalls.set(event.toolCallId, {
      toolName: event.toolName,
      args: event.args ?? {},
    });
  }

  // Process tool execution end for error/test detection
  if (event.type === "tool_execution_end" && event.toolCallId) {
    const pending = state.pendingToolCalls.get(event.toolCallId);
    state.pendingToolCalls.delete(event.toolCallId);

    const resultText = extractResultText(event.result);

    // Detect errors from tool results
    if (event.isError || ERROR_LINE_PATTERN.test(resultText)) {
      if (resultText) {
        state.errorLines.push({ type: "error", text: resultText.slice(0, 200) });
      }
    }

    // Detect test results only from bash tool calls running actual test commands.
    // Gates on isTestCommand() to prevent false positives from non-test bash commands
    // that happen to contain "pass"/"fail" strings (e.g., grep output).
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
```

**Verify:** `bun test tests/subagent-runner.test.ts`

---

### Task 9: Dependency validation for subagent dispatch

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

  it("returns error when tasks array is empty (plan missing or unparseable)", () => {
    const result = validateTaskDependencies(1, [], []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No tasks");
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
 *
 * Returns an error if the tasks array is empty (plan missing or unparseable)
 * to prevent silently bypassing dependency validation.
 */
export function validateTaskDependencies(
  taskIndex: number,
  tasks: PlanTask[],
  completedTaskIndices: number[],
): ValidationResult {
  if (tasks.length === 0) {
    return { valid: false, error: "No tasks found in plan. Ensure plan.md exists and has parseable tasks." };
  }

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

### Task 10: Async dispatch config

**Files:**
- Create: `extensions/megapowers/subagent-async.ts`
- Test: `tests/subagent-async.test.ts`

**Test:**
```typescript
// tests/subagent-async.test.ts
import { describe, it, expect } from "bun:test";
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
      workspacePath: "/project/.megapowers/subagents/sa-001/workspace",
    });
    expect(config.id).toBe("sa-001");
    expect(config.prompt).toBe("Do the thing");
    expect(config.workspacePath).toBe("/project/.megapowers/subagents/sa-001/workspace");
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
    thinking: input.thinking,
    systemPromptPath: input.systemPromptPath,
  };
}
```

**Verify:** `bun test tests/subagent-async.test.ts`

---

### Task 11: Subagent tool handlers — dispatch and status [depends: 3, 4, 7, 8, 9, 10]

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
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  it("returns error when megapowers is disabled", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("disabled");
  });

  it("returns error when no active issue", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" });
    expect(result.error).toContain("No active issue");
  });

  it("returns error when jj is not available", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Do thing" }, {
      isJJRepo: async () => false,
    });
    expect(result.error).toContain("jj");
  });

  it("returns subagent ID on successful dispatch", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Build the parser" }, {
      isJJRepo: async () => true,
    });
    expect(result.id).toBeDefined();
    expect(result.id).toMatch(/^sa-/);
    expect(result.error).toBeUndefined();
  });

  it("includes task index in ID when taskIndex is provided", async () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: Setup\n\n### Task 2: Build\n");

    const result = await handleSubagentDispatch(tmp, { task: "Build", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.id).toMatch(/^sa-t2-/);
  });

  it("blocks dispatch when task dependencies are not met", async () => {
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "plan.md"), "### Task 1: A\n\n### Task 2: B [depends: 1]\n");

    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: true,
      completedTasks: [],
    });

    const result = await handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("depend");
  });

  it("returns error when taskIndex provided but no plan tasks found", async () => {
    // No plan.md exists at all
    const result = await handleSubagentDispatch(tmp, { task: "Do thing", taskIndex: 1 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toContain("No tasks");
  });

  it("allows dispatch when task dependencies are met", async () => {
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

    const result = await handleSubagentDispatch(tmp, { task: "Build B", taskIndex: 2 }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    expect(result.id).toBeDefined();
  });

  it("persists agent system prompt to disk and includes systemPromptPath in config", async () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: test-model\nthinking: full\n---\nYou are a custom worker.`);

    const result = await handleSubagentDispatch(tmp, { task: "Build thing", agent: "worker" }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    expect(result.config!.systemPromptPath).toBeDefined();
    expect(result.config!.thinking).toBe("full");

    // Verify the system prompt was written to disk
    const promptContent = readFileSync(result.config!.systemPromptPath!, "utf-8");
    expect(promptContent).toBe("You are a custom worker.");
  });

  it("writes prompt to file instead of passing inline", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "Build the parser" }, {
      isJJRepo: async () => true,
    });
    expect(result.error).toBeUndefined();
    // Verify prompt file was created
    const promptPath = join(tmp, ".megapowers", "subagents", result.id!, "prompt.md");
    expect(existsSync(promptPath)).toBe(true);
    const promptContent = readFileSync(promptPath, "utf-8");
    expect(promptContent).toContain("Build the parser");
  });

  it("returns DispatchConfig for spawning", async () => {
    const result = await handleSubagentDispatch(tmp, { task: "test" }, {
      isJJRepo: async () => true,
    });
    expect(result.config).toBeDefined();
    expect(result.config!.id).toBe(result.id);
    expect(result.config!.workspacePath).toContain(".megapowers/subagents");
  });
});

describe("handleSubagentStatus", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "subagent-status-tool-test-"));
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
      diff: "--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1 @@\n-old\n+new",
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

  it("returns detected errors for stuck subagent", () => {
    writeSubagentStatus(tmp, "sa-004", {
      id: "sa-004",
      state: "failed",
      turnsUsed: 8,
      startedAt: 1000,
      completedAt: 5000,
      detectedErrors: ["TypeError: x is not a function"],
    });
    const result = handleSubagentStatus(tmp, "sa-004");
    expect(result.status!.detectedErrors).toEqual(["TypeError: x is not a function"]);
  });
});
```

**Implementation:**
```typescript
// extensions/megapowers/subagent-tools.ts
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

/** Minimal interface for jj check — allows mocking in tests. */
export interface JJCheck {
  isJJRepo: () => Promise<boolean>;
}

/**
 * Handle the subagent dispatch request. Validates state, checks jj,
 * resolves agent, validates dependencies, writes prompt to file,
 * and builds the dispatch config.
 *
 * Does NOT spawn the process — that's done by the caller (index.ts)
 * using the returned DispatchConfig with child_process.spawn.
 */
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

  // jj is required for workspace isolation
  if (jjCheck) {
    const isRepo = await jjCheck.isJJRepo();
    if (!isRepo) {
      return { error: "jj is required for subagent workspace isolation. This does not appear to be a jj repository." };
    }
  }

  // Resolve agent
  const agent = resolveAgent(input.agent, cwd);

  // Generate ID
  const id = generateSubagentId(input.taskIndex);

  // Ensure subagent dir exists
  const saDir = subagentDir(cwd, id);
  if (!existsSync(saDir)) mkdirSync(saDir, { recursive: true });

  // Persist agent system prompt to disk so pi can load it via --append-system-prompt
  let systemPromptPath: string | undefined;
  if (agent?.systemPrompt) {
    const promptPath = join(saDir, "agent-prompt.md");
    writeFileSync(promptPath, agent.systemPrompt);
    systemPromptPath = promptPath;
  }

  // Validate task dependencies if taskIndex provided
  if (input.taskIndex !== undefined) {
    const tasks = deriveTasks(cwd, state.activeIssue);
    // Require tasks to exist when taskIndex is provided — prevents silent bypass
    const result = validateTaskDependencies(input.taskIndex, tasks, state.completedTasks);
    if (!result.valid) {
      const reason = result.unmetDependencies
        ? `Task ${input.taskIndex} depends on incomplete tasks: ${result.unmetDependencies.join(", ")}`
        : result.error ?? "Dependency validation failed.";
      return { error: reason };
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

  // Write prompt to file to avoid OS command-line length limits
  const promptFilePath = join(saDir, "prompt.md");
  writeFileSync(promptFilePath, prompt);

  // Build workspace path under .megapowers/subagents/<id>/workspace
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

### Task 12: Project-root resolution for satellite TDD enforcement [depends: 8]

**Files:**
- Modify: `extensions/megapowers/subagent-runner.ts` (already has `projectRoot` in `buildSpawnEnv`)
- Modify: `extensions/megapowers/index.ts` (satellite mode block)
- Test: `tests/subagent-runner.test.ts` (append)
- Test: `tests/satellite-root.test.ts` (new)

This task fixes AC16: without it, subagent sessions running in jj workspace dirs have no `.megapowers/state.json`, so `readState()` returns defaults (phase=null) and `canWrite()` becomes pass-through — no TDD enforcement.

**Test:**
```typescript
// tests/satellite-root.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { resolveProjectRoot } from "../extensions/megapowers/satellite.js";

describe("resolveProjectRoot", () => {
  it("returns MEGA_PROJECT_ROOT when set", () => {
    const root = resolveProjectRoot("/workspace/sa-001/workspace", { MEGA_PROJECT_ROOT: "/project" });
    expect(root).toBe("/project");
  });

  it("returns cwd when MEGA_PROJECT_ROOT is not set", () => {
    const root = resolveProjectRoot("/project", {});
    expect(root).toBe("/project");
  });

  it("returns cwd when MEGA_PROJECT_ROOT is empty string", () => {
    const root = resolveProjectRoot("/project", { MEGA_PROJECT_ROOT: "" });
    expect(root).toBe("/project");
  });
});
```

```typescript
// tests/subagent-runner.test.ts — append
describe("buildSpawnEnv projectRoot", () => {
  it("sets MEGA_PROJECT_ROOT to enable satellite root resolution", () => {
    const env = buildSpawnEnv({ subagentId: "sa-1", projectRoot: "/my/project" });
    expect(env.MEGA_PROJECT_ROOT).toBe("/my/project");
    expect(env.PI_SUBAGENT).toBe("1");
  });
});
```

**Implementation — satellite.ts:**
```typescript
// Add to extensions/megapowers/satellite.ts

/**
 * Resolve the project root for state reads.
 * In satellite mode (subagent), the cwd is the jj workspace dir which
 * doesn't have .megapowers/state.json. MEGA_PROJECT_ROOT points to the
 * actual project root where state.json lives.
 */
export function resolveProjectRoot(
  cwd: string,
  env: Record<string, string | undefined>,
): string {
  const projectRoot = env.MEGA_PROJECT_ROOT;
  if (projectRoot && projectRoot.length > 0) return projectRoot;
  return cwd;
}
```

**Implementation — index.ts satellite block:**

In the satellite mode section of `index.ts`, update every `readState(ctx.cwd)` call to use `resolveProjectRoot`:

```typescript
// At the top of the satellite block, after the isSatelliteMode check:
import { resolveProjectRoot } from "./satellite.js";

// Change all satellite readState calls from:
//   const state = readState(ctx.cwd);
// To:
//   const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
//   const state = readState(projectRoot);
```

Specifically, in the satellite `tool_call` handler:
```typescript
pi.on("tool_call", async (event, ctx) => {
  // ...
  const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
  const state = readState(projectRoot);
  // ... rest uses state as before
});
```

And in the satellite `tool_result` handler:
```typescript
pi.on("tool_result", async (event, ctx) => {
  // ...
  const projectRoot = resolveProjectRoot(ctx.cwd, process.env as Record<string, string | undefined>);
  const state = readState(projectRoot);
  // ... rest uses state as before
});
```

**Verify:** `bun test tests/satellite-root.test.ts tests/subagent-runner.test.ts`

---

### Task 13: Register subagent and subagent_status tools in index.ts [depends: 6, 8, 11, 12]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts

describe("subagent available in all phases", () => {
  const phases = ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "reproduce", "diagnose"] as const;

  for (const phase of phases) {
    it(`handleSubagentDispatch works in ${phase} phase`, async () => {
      const tmp = mkdtempSync(join(tmpdir(), `phase-${phase}-`));
      const workflow = ["reproduce", "diagnose"].includes(phase) ? "bugfix" : "feature";
      writeState(tmp, {
        ...createInitialState(),
        activeIssue: "001-test",
        workflow: workflow as any,
        phase: phase as any,
        megaEnabled: true,
      });
      const result = await handleSubagentDispatch(tmp, { task: "Do thing" }, {
        isJJRepo: async () => true,
      });
      expect(result.error).toBeUndefined();
      expect(result.id).toBeDefined();
      rmSync(tmp, { recursive: true, force: true });
    });
  }
});

describe("satellite TDD enforcement", () => {
  it("sets PI_SUBAGENT=1 in spawn env for TDD enforcement", async () => {
    const { isSatelliteMode } = await import("../extensions/megapowers/satellite.js");
    const { buildSpawnEnv: buildEnv } = await import("../extensions/megapowers/subagent-runner.js");

    const env = buildEnv({ subagentId: "sa-test" });
    expect(isSatelliteMode({ isTTY: false, env })).toBe(true);
  });

  it("sets MEGA_PROJECT_ROOT so satellite can read state", async () => {
    const { buildSpawnEnv: buildEnv } = await import("../extensions/megapowers/subagent-runner.js");
    const { resolveProjectRoot } = await import("../extensions/megapowers/satellite.js");

    const env = buildEnv({ subagentId: "sa-test", projectRoot: "/my/project" });
    const root = resolveProjectRoot("/workspace/sa-test/workspace", env);
    expect(root).toBe("/my/project");
  });
});

describe("no auto-squash", () => {
  it("handleSubagentStatus returns diff without squashing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "no-squash-"));
    writeSubagentStatus(tmp, "sa-nosquash", {
      id: "sa-nosquash",
      state: "completed",
      turnsUsed: 3,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/a.ts"],
      diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new",
      testsPassed: true,
    });

    // The handler ONLY reads status, it never calls jj squash
    const result = handleSubagentStatus(tmp, "sa-nosquash");
    expect(result.status!.state).toBe("completed");
    expect(result.status!.diff).toContain("src/a.ts");
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("subagent_status returns JSON", () => {
  it("status result is structured data, not just human text", () => {
    const tmp = mkdtempSync(join(tmpdir(), "json-status-"));
    writeSubagentStatus(tmp, "sa-json", {
      id: "sa-json",
      state: "completed",
      turnsUsed: 4,
      startedAt: 1000,
      completedAt: 2000,
      filesChanged: ["src/x.ts"],
      diff: "M src/x.ts",
      testsPassed: true,
    });
    const result = handleSubagentStatus(tmp, "sa-json");
    // The status object IS the structured data (AC6)
    expect(result.status).toBeDefined();
    expect(typeof result.status!.state).toBe("string");
    expect(typeof result.status!.turnsUsed).toBe("number");
    expect(Array.isArray(result.status!.filesChanged)).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Implementation:**

Add these imports near the top of `extensions/megapowers/index.ts`:

```typescript
import { handleSubagentDispatch, handleSubagentStatus } from "./subagent-tools.js";
import { writeSubagentStatus, updateSubagentStatus } from "./subagent-status.js";
import { buildSpawnArgs, buildSpawnEnv, createRunnerState, processJsonlLine } from "./subagent-runner.js";
import { buildWorkspaceName, buildWorkspaceAddArgs, buildWorkspaceForgetArgs, buildDiffSummaryArgs, buildDiffFullArgs, workspacePath } from "./subagent-workspace.js";
import { detectRepeatedErrors } from "./subagent-errors.js";
import { parseTaskDiffFiles } from "./task-coordinator.js";
```

Add after the existing `create_batch` tool registration block:

```typescript
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

      const result = await handleSubagentDispatch(ctx.cwd, {
        task: params.task,
        taskIndex: params.taskIndex,
        agent: params.agent,
        timeoutMs: params.timeoutMs,
      }, jj);

      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }

      const config = result.config!;
      const id = result.id!;
      const promptFilePath = result.promptFilePath!;
      const startedAt = Date.now();

      // Write initial status with parent's current workflow phase (AC5)
      const currentState = readState(ctx.cwd);
      writeSubagentStatus(ctx.cwd, id, {
        id,
        state: "running",
        turnsUsed: 0,
        startedAt,
        phase: currentState.phase ?? undefined,
      });

      // Create jj workspace and spawn (async, fire-and-forget)
      const wsName = buildWorkspaceName(id);

      (async () => {
        const runnerState = createRunnerState(id, startedAt);

        try {
          // Create jj workspace
          const wsResult = await pi.exec("jj", buildWorkspaceAddArgs(wsName, config.workspacePath));
          if (wsResult.code !== 0) {
            writeSubagentStatus(ctx.cwd, id, {
              id,
              state: "failed",
              turnsUsed: 0,
              startedAt,
              completedAt: Date.now(),
              error: `Failed to create jj workspace: ${wsResult.stderr}`,
            });
            return;
          }

          // Build spawn args — pass prompt as @file reference
          const args = buildSpawnArgs(promptFilePath, {
            model: config.model,
            tools: config.tools,
            thinking: config.thinking,
            systemPromptPath: config.systemPromptPath,
          });
          // Set MEGA_PROJECT_ROOT so satellite reads the real state.json (AC16)
          const env = buildSpawnEnv({
            subagentId: id,
            projectRoot: ctx.cwd,
          });

          const { spawn } = await import("node:child_process");
          const child = spawn(args[0], args.slice(1), {
            cwd: config.workspacePath,
            env,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

          let stderr = "";
          let stdoutBuffer = "";

          // Stream JSONL from stdout, update status incrementally
          child.stdout?.on("data", (data: Buffer) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop() || "";
            for (const line of lines) {
              processJsonlLine(runnerState, line);
            }
            // Periodic status update — uses merge to preserve phase
            if (!runnerState.isTerminal) {
              updateSubagentStatus(ctx.cwd, id, { turnsUsed: runnerState.turnsUsed });
            }
          });

          child.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

          // Timeout handling: only set terminal flag and kill the process.
          // All cleanup (workspace forget) happens in the close handler.
          const timer = setTimeout(() => {
            if (runnerState.isTerminal) return;
            runnerState.isTerminal = true;
            runnerState.timedOut = true;

            try { child.kill("SIGTERM"); } catch {}
            // Escalate to SIGKILL after 5 seconds
            setTimeout(() => {
              try { if (!child.killed) child.kill("SIGKILL"); } catch {}
            }, 5000);
          }, config.timeoutMs);

          child.on("close", async (code) => {
            clearTimeout(timer);

            const detectedErrors = detectRepeatedErrors(runnerState.errorLines);

            if (runnerState.timedOut) {
              // Timed out — write terminal status
              writeSubagentStatus(ctx.cwd, id, {
                id,
                state: "timed-out",
                turnsUsed: runnerState.turnsUsed,
                startedAt,
                completedAt: Date.now(),
                phase: currentState.phase ?? undefined,
                error: `Subagent timed out after ${config.timeoutMs / 1000}s`,
                detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
              });
            } else if (runnerState.isTerminal) {
              // Already handled (shouldn't happen, but guard)
            } else {
              runnerState.isTerminal = true;

              // Process any remaining buffered output
              if (stdoutBuffer.trim()) {
                processJsonlLine(runnerState, stdoutBuffer);
              }

              if (code !== 0) {
                writeSubagentStatus(ctx.cwd, id, {
                  id,
                  state: "failed",
                  turnsUsed: runnerState.turnsUsed,
                  startedAt,
                  completedAt: Date.now(),
                  phase: currentState.phase ?? undefined,
                  error: `Process exited with code ${code}. ${stderr}`.trim(),
                  detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
                });
              } else {
                // Get both summary and full diff from workspace (AC7)
                // Uses pi.exec() with { cwd } option to run jj in the workspace directory.
                // pi.exec supports ExecOptions.cwd per the SDK type definitions.
                // We call pi.exec directly here, NOT through createJJ() wrapper which
                // doesn't forward options.
                try {
                  const summaryResult = await pi.exec("jj", buildDiffSummaryArgs(), { cwd: config.workspacePath });
                  const filesChanged = parseTaskDiffFiles(summaryResult.stdout);
                  const fullDiffResult = await pi.exec("jj", buildDiffFullArgs(), { cwd: config.workspacePath });

                  // If full diff is very large (>100KB), store to file
                  const MAX_INLINE_DIFF = 100 * 1024;
                  let diff: string | undefined;
                  let diffPath: string | undefined;

                  if (fullDiffResult.stdout.length > MAX_INLINE_DIFF) {
                    const { join: joinPath } = await import("node:path");
                    const { writeFileSync: writeFile } = await import("node:fs");
                    const patchPath = joinPath(ctx.cwd, ".megapowers", "subagents", id, "diff.patch");
                    writeFile(patchPath, fullDiffResult.stdout);
                    diffPath = `.megapowers/subagents/${id}/diff.patch`;
                  } else {
                    diff = fullDiffResult.stdout;
                  }

                  writeSubagentStatus(ctx.cwd, id, {
                    id,
                    state: "completed",
                    turnsUsed: runnerState.turnsUsed,
                    startedAt,
                    completedAt: Date.now(),
                    phase: currentState.phase ?? undefined,
                    filesChanged,
                    diff,
                    diffPath,
                    testsPassed: runnerState.lastTestPassed ?? true,
                    detectedErrors: detectedErrors.length > 0 ? detectedErrors : undefined,
                  });
                } catch {
                  writeSubagentStatus(ctx.cwd, id, {
                    id,
                    state: "completed",
                    turnsUsed: runnerState.turnsUsed,
                    startedAt,
                    completedAt: Date.now(),
                    phase: currentState.phase ?? undefined,
                    testsPassed: runnerState.lastTestPassed ?? true,
                  });
                }
              }
            }

            // Always cleanup workspace — happens after process exit (AC9)
            try {
              await pi.exec("jj", buildWorkspaceForgetArgs(wsName));
            } catch {}
          });

          child.unref();
        } catch (err) {
          runnerState.isTerminal = true;
          writeSubagentStatus(ctx.cwd, id, {
            id,
            state: "failed",
            turnsUsed: 0,
            startedAt,
            completedAt: Date.now(),
            phase: currentState.phase ?? undefined,
            error: `Spawn failed: ${err}`,
          });
          // Cleanup workspace on error
          try {
            await pi.exec("jj", buildWorkspaceForgetArgs(wsName));
          } catch {}
        }
      })();

      return {
        content: [{ type: "text", text: `Subagent dispatched: ${id}\nWorkspace: ${wsName}\nUse subagent_status to check progress.` }],
        details: undefined,
      };
    },
  });

  // --- Tools: subagent_status ---

  pi.registerTool({
    name: "subagent_status",
    label: "Subagent Status",
    description: "Check the status of a running subagent. Returns JSON with state, files changed, test results, diff, and detected errors.",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID returned from the subagent tool" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSubagentStatus(ctx.cwd, params.id);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }

      // Return JSON for machine-safe LLM parsing (AC6)
      const s = result.status!;
      return {
        content: [{ type: "text", text: JSON.stringify(s, null, 2) }],
        details: undefined,
      };
    },
  });
```

Note on `RunnerState.timedOut`: add `timedOut?: boolean` to `RunnerState` interface and initialize to `false` in `createRunnerState()`.

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 14: Hide/show subagent tools with mega off/on [depends: 13]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/subagent-tools.test.ts` (append)

**Test:**
```typescript
// Append to tests/subagent-tools.test.ts

describe("mega off disables subagent dispatch", () => {
  it("returns error when megaEnabled is false", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mega-off-"));
    writeState(tmp, {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
      megaEnabled: false,
    });
    const result = await handleSubagentDispatch(tmp, { task: "test" });
    expect(result.error).toContain("disabled");
    rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Implementation:**

In the `/mega off` command handler in `extensions/megapowers/index.ts`, update the filter to also exclude subagent tools:

```typescript
// In /mega off handler:
const activeTools = pi.getActiveTools().filter(
  t => t !== "megapowers_signal" && t !== "megapowers_save_artifact" && t !== "subagent" && t !== "subagent_status"
);
```

In the `/mega on` handler, restore them:

```typescript
// In /mega on handler:
const activeTools = pi.getActiveTools();
const toolsToAdd = ["megapowers_signal", "megapowers_save_artifact", "subagent", "subagent_status"];
const missing = toolsToAdd.filter(t => !activeTools.includes(t));
if (missing.length > 0) {
  pi.setActiveTools([...activeTools, ...missing]);
}
```

**Verify:** `bun test tests/subagent-tools.test.ts`

---

### Task 15: UPSTREAM.md tracking

**Files:**
- Create: `extensions/megapowers/UPSTREAM.md`

**Test:**
```typescript
// tests/subagent-agents.test.ts — append
import { existsSync as fileExists } from "node:fs";

describe("UPSTREAM.md", () => {
  it("exists in extensions/megapowers/ directory", () => {
    const upstreamPath = join(thisTestDir, "..", "extensions", "megapowers", "UPSTREAM.md");
    expect(fileExists(upstreamPath)).toBe(true);
  });

  it("contains pinned commit reference", () => {
    const upstreamPath = join(thisTestDir, "..", "extensions", "megapowers", "UPSTREAM.md");
    const content = readFileSync(upstreamPath, "utf-8");
    expect(content).toContain("1281c04");
  });
});
```

**Implementation:**

```markdown
# Upstream Dependencies

## pi-subagents

- **Repository:** https://github.com/nicobailon/pi-subagents
- **Pinned Commit:** 1281c04 (feat: background mode toggle and --bg slash command flag)
- **Patterns Used:**
  - Async runner with status file protocol
  - Agent discovery from markdown files with YAML frontmatter
  - Error detection via repeated failure heuristics
  - Compatible frontmatter schema: `name`, `model`, `tools`, `thinking`
  - JSONL streaming for turn counting and test result detection
  - SIGTERM→SIGKILL escalation for timeout handling
- **Patterns Not Used:**
  - Agent chains/pipelines
  - Agent manager UI
  - MCP integration
  - Session sharing
- **Last Audit:** 2026-02-24

## pi example subagent extension

- **Source:** pi-coding-agent/examples/extensions/subagent/
- **Patterns Used:**
  - `spawn("pi", ["--mode", "json", "-p", "--no-session", ...])` invocation
  - `--append-system-prompt` for agent system prompts
  - `@file` arg for prompt to avoid CLI length limits
  - JSONL stdout parsing with `message_end` / `tool_execution_end` events
  - Prompt written to temp file, cleaned up after completion

## Audit Schedule

Review pi-subagents for improvements to shared patterns quarterly or when upstream publishes breaking changes.
```

**Verify:** `bun test tests/subagent-agents.test.ts`

---

## Acceptance Criteria Coverage

| AC | Task(s) | Description |
|----|---------|-------------|
| 1 | 11, 13 | `subagent` tool registered via pi.registerTool() |
| 2 | 11, 13 | `subagent_status` tool registered via pi.registerTool() |
| 3 | 6, 13 | jj workspace created via `jj workspace add` with path under `.megapowers/subagents/<id>/workspace` |
| 4 | 8, 13 | Detached pi process with `--mode json -p --no-session`, PI_SUBAGENT=1, returns ID immediately |
| 5 | 4, 8, 13 | Status.json updated via merge semantics preserving phase; parent writes status from JSONL stream |
| 6 | 4, 11, 13 | subagent_status returns JSON: state, files, tests, turns, detected errors |
| 7 | 6, 13 | Completed status includes both `jj diff --summary` (filesChanged) AND `jj diff` (full patch) |
| 8 | 11 (no-auto-squash test) | Status returns diff only, no squash call |
| 9 | 6, 13 | Workspace cleanup via `jj workspace forget` in close handler after process exit |
| 10 | 8, 13 | Non-zero exit → failed state + error + detected errors |
| 11 | 10, 13 | Configurable timeout, SIGTERM→SIGKILL escalation, cleanup after exit |
| 12 | 1, 3 | Agent markdown frontmatter parsing, priority search (project → user → builtin) |
| 13 | 2 | Three builtin agents: worker (read/write/edit/bash), scout (read/bash), reviewer (read/bash) |
| 14 | 1 | pi-subagents compatible frontmatter schema |
| 15 | 13 (all-phases test) | Available in all workflow phases |
| 16 | 8, 12, 13 | Satellite TDD via PI_SUBAGENT=1 + MEGA_PROJECT_ROOT for state reads |
| 17 | Pre-existing | [depends: N, M] already in plan-parser.ts |
| 18 | 9, 11 | Dependency validation before spawn; error when plan missing |
| 19 | 7, 11 | Task context from plan section + learnings; prompt written to @file |
| 20 | 5, 8, 13 | Error detection from tool_execution_end results AND assistant message text |
| 21 | 15 | UPSTREAM.md with pinned commit 1281c04 |