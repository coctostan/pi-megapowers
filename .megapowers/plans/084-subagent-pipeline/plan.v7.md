# Plan: Subagent Pipeline (#084) — v6

## AC → Task Mapping

| AC | Task(s) |
|----|---------|
| 3 | 1 |
| 1 | 2 |
| 17 | 3, 10 |
| 2 | 4 |
| 13–15 | 5 |
| 10–12 | 6 |
| 23–24 | 7 |
| 19–22 | 8, 9 |
| 18 | 10 |
| 4–9, 16 | 11 |
| 26 | 12 |
| 27 | 13, 14 |
| 25, 28 | 14, 19 |
| 29–30 | 15 |
| 31–33 | 16 |
| 34 | 20 |

> Note: This plan includes required satellite compatibility updates for pi-subagents-spawned agents (pi-subagents sets `PI_SUBAGENT_DEPTH`, not `PI_SUBAGENT=1`) and an explicit implementer-side TDD unlock signal for the current satellite hard gate.

> **v5 revision notes:** Addresses v4 review feedback: (1) Task 10 adds `[depends: 3]` for message-utils dependency, (2) Task 11 adds explicit test assertion that TDD compliance report is included in reviewer context (AC 16), (3) Task 15 adds `[depends: 8, 10]` for workspace and parse helpers, (4) Task 18 split into 18 (commands filtering) and 19 (tool registration wiring) with explicit dependencies, (5) Task 20 (was 19) clean-slate test expanded to cover all 9 deleted modules with `[depends: 19]`.

> **v6 revision notes:** Addresses v5 review feedback: (1) Task 6 `accumulatedReviewFindings` changed from `string` to `string[]` so findings accumulate across retry cycles (AC 12), with a new test proving multiple `setRetryContext` calls preserve earlier findings. (2) Task 16 adds `megapowers_signal` to implementer agent's `tools:` frontmatter so the TDD `tests_failed` unlock is callable.

---

## Conventions

- **Language:** TypeScript
- **Test runner:** `bun test`
- **Per-test-file run:** `bun test tests/<file>.test.ts`
- **Imports:** production `.ts` files import other modules via `.js` extension (repo convention).

---

## Task 1: Add `pi-subagents` dependency [no-test]

**Justification:** Dependency / lockfile change only.

**Covers AC 3.**

**Files:**
- Modify: `package.json`

**Step 1 — Make the change**

Add to `package.json`:

```json
{
  "dependencies": {
    "pi-subagents": "^0.11.0"
  }
}
```

**Step 2 — Verify**
Run: `bun install`

Expected: install succeeds.

Run: `bunx tsc --noEmit`

Expected: no type errors.

---

## Task 2: Dispatcher types (`DispatchConfig`, `DispatchResult`, `Dispatcher`) [no-test]

**Justification:** Pure type/interface definitions.

**Covers AC 1.**

**Files:**
- Create: `extensions/megapowers/subagent/dispatcher.ts`

**Step 1 — Make the change**
Create `extensions/megapowers/subagent/dispatcher.ts`:

```ts
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
```

**Step 2 — Verify**
Run: `bunx tsc --noEmit`

Expected: no type errors.

---

## Task 3: Message parsing utilities (`extractFilesChanged`, `extractTestsPassed`, `extractFinalOutput`, `extractToolCalls`) 

**Covers AC 17 (files/tests/final output extraction).**

**Files:**
- Create: `extensions/megapowers/subagent/message-utils.ts`
- Test: `tests/message-utils.test.ts`

**Step 1 — Write the failing test**
Create `tests/message-utils.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import {
  extractFilesChanged,
  extractTestsPassed,
  extractFinalOutput,
  extractToolCalls,
  type ToolCallRecord,
} from "../extensions/megapowers/subagent/message-utils.js";

// Minimal Message-like objects for tests.

describe("extractFilesChanged", () => {
  it("extracts and deduplicates paths from write/edit tool calls", () => {
    const messages: any[] = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "1", name: "write", input: { path: "src/a.ts", content: "x" } },
          { type: "tool_use", id: "2", name: "edit", input: { path: "src/b.ts" } },
          { type: "tool_use", id: "3", name: "edit", input: { path: "src/a.ts" } },
        ],
      },
    ];

    expect(extractFilesChanged(messages)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("extractTestsPassed", () => {
  it("returns true when last matching test command output indicates 0 fails", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "t1", content: "5 pass\n0 fail" }] },
    ];
    expect(extractTestsPassed(messages)).toBe(true);
  });

  it("returns false when a matching test command output indicates failures", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "t1", content: "3 pass\n2 fail" }] },
    ];
    expect(extractTestsPassed(messages)).toBe(false);
  });

  it("returns null when no matching test command is present", () => {
    const messages: any[] = [{ role: "assistant", content: [{ type: "text", text: "done" }] }];
    expect(extractTestsPassed(messages)).toBe(null);
  });
});

describe("extractFinalOutput", () => {
  it("concatenates assistant text blocks", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "text", text: "First" }] },
      { role: "assistant", content: [{ type: "text", text: "Second" }] },
    ];
    expect(extractFinalOutput(messages)).toContain("First");
    expect(extractFinalOutput(messages)).toContain("Second");
  });
});

describe("extractToolCalls", () => {
  it("produces ordered ToolCallRecord list including bash outputs", () => {
    const messages: any[] = [
      { role: "assistant", content: [{ type: "tool_use", id: "1", name: "write", input: { path: "tests/a.test.ts" } }] },
      { role: "assistant", content: [{ type: "tool_use", id: "2", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "2", content: "1 fail" }] },
    ];

    const calls = extractToolCalls(messages);
    expect(calls).toEqual([
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
    ] satisfies ToolCallRecord[]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/message-utils.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/message-utils.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/message-utils.ts`:

```ts
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

function isTestCommand(cmd: string): boolean {
  return TEST_COMMAND_PATTERNS.some((p) => p.test(cmd));
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
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/message-utils.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 4: `PiSubagentsDispatcher` (runSync wrapper + config translation)

**Covers AC 2.**

**Files:**
- Create: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Test: `tests/pi-subagents-dispatcher.test.ts`

**Step 1 — Write the failing test**

Create `tests/pi-subagents-dispatcher.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { PiSubagentsDispatcher } from "../extensions/megapowers/subagent/pi-subagents-dispatcher.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { RunSyncOptions, SingleResult } from "pi-subagents/types.js";

describe("PiSubagentsDispatcher", () => {
  it("maps DispatchConfig overrides onto an agent config and calls runSync", async () => {
    let captured: any = null;

    const mockRunSync = async (
      runtimeCwd: string,
      agents: AgentConfig[],
      agentName: string,
      task: string,
      options: RunSyncOptions,
    ): Promise<SingleResult> => {
      captured = { runtimeCwd, agents, agentName, task, options };
      return {
        agent: agentName,
        task,
        exitCode: 0,
        messages: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 1 },
      };
    };

    const baseAgents: AgentConfig[] = [
      {
        name: "implementer",
        description: "impl",
        tools: ["read"],
        model: "anthropic/claude-haiku-4-5",
        thinking: "low",
        systemPrompt: "BASE",
        source: "project",
        filePath: "/x",
      },
    ];

    const d = new PiSubagentsDispatcher({ runSync: mockRunSync, runtimeCwd: "/runtime", agents: baseAgents });

    await d.dispatch({
      agent: "implementer",
      task: "Do the work",
      cwd: "/workspace",
      context: "extra ctx",
      model: "anthropic/claude-sonnet-4-5",
      thinking: "high",
      tools: ["read", "write"],
      systemPrompt: "OVERRIDE",
      timeoutMs: 1234,
    });

    expect(captured.runtimeCwd).toBe("/runtime");
    expect(captured.agentName).toBe("implementer");

    expect(captured.task).toContain("Do the work");
    expect(captured.task).toContain("## Context");
    expect(captured.task).toContain("extra ctx");

    const impl = captured.agents.find((a: any) => a.name === "implementer");
    expect(impl.model).toBe("anthropic/claude-sonnet-4-5");
    expect(impl.thinking).toBe("high");
    expect(impl.tools).toEqual(["read", "write"]);
    expect(impl.systemPrompt).toContain("BASE");
    expect(impl.systemPrompt).toContain("OVERRIDE");

    expect(captured.options.cwd).toBe("/workspace");
    expect(typeof captured.options.runId).toBe("string");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pi-subagents-dispatcher.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`:

```ts
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
        messages: result.messages,
        filesChanged: [],
        testsPassed: null,
        error: result.error,
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
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 5: TDD auditor (`auditTddCompliance`) — deterministic index-based ordering

**Covers AC 13, 14, 15.**

**Files:**
- Create: `extensions/megapowers/subagent/tdd-auditor.ts`
- Test: `tests/tdd-auditor.test.ts`

**Step 1 — Write the failing test**
Create `tests/tdd-auditor.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { auditTddCompliance, type ToolCallRecord } from "../extensions/megapowers/subagent/tdd-auditor.js";

describe("auditTddCompliance", () => {
  it("reports compliant order: test write -> test run -> prod write -> test run", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
      { tool: "edit", args: { path: "src/a.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 pass\n0 fail" },
    ];

    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.testRanBeforeProduction).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
    expect(r.testRunCount).toBe(2);
  });

  it("detects production .ts written before any test file", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "src/a.ts" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "bash", args: { command: "bun test" }, output: "0 fail" },
    ];

    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(false);
    expect(r.productionFilesBeforeTest).toEqual(["src/a.ts"]);
  });

  it("excludes config files from ordering checks", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "package.json" } },
      { tool: "write", args: { path: "tsconfig.json" } },
      { tool: "write", args: { path: ".gitignore" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
      { tool: "edit", args: { path: "src/a.ts" } },
    ];

    const r = auditTddCompliance(calls);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
  });

  it("only treats .ts/.js as production files", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "README.md" } },
      { tool: "write", args: { path: "src/a.ts" } },
      { tool: "write", args: { path: "tests/a.test.ts" } },
    ];

    const r = auditTddCompliance(calls);
    expect(r.productionFilesBeforeTest).toEqual(["src/a.ts"]);
  });

  it("returns clean report for empty input", () => {
    const r = auditTddCompliance([]);
    expect(r.testWrittenFirst).toBe(true);
    expect(r.testRanBeforeProduction).toBe(true);
    expect(r.productionFilesBeforeTest).toEqual([]);
    expect(r.testRunCount).toBe(0);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/tdd-auditor.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/tdd-auditor.ts`:

```ts
export interface ToolCallRecord {
  tool: string;
  args: Record<string, any>;
  output?: string;
}

export interface TddComplianceReport {
  testWrittenFirst: boolean;
  testRanBeforeProduction: boolean;
  productionFilesBeforeTest: string[];
  testRunCount: number;
}

const TEST_FILE_PATTERNS = [/\.test\.[jt]s$/i, /\.spec\.[jt]s$/i, /(^|\/)tests\//i];
const PROD_FILE_PATTERN = /\.(ts|js)$/i;
const CONFIG_FILES = new Set(["package.json", "tsconfig.json", ".gitignore"]);
const WRITE_TOOLS = new Set(["write", "edit"]);
const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/i,
  /\bnpm\s+test\b/i,
  /\bpnpm\s+test\b/i,
  /\byarn\s+test\b/i,
  /\bnpx?\s+(jest|vitest|mocha)\b/i,
];

function isTestFile(p: string): boolean {
  return TEST_FILE_PATTERNS.some((re) => re.test(p));
}

function isConfigFile(p: string): boolean {
  return CONFIG_FILES.has(p);
}

function isProdFile(p: string): boolean {
  return PROD_FILE_PATTERN.test(p) && !isTestFile(p);
}

function isTestCommand(cmd: string): boolean {
  return TEST_COMMAND_PATTERNS.some((re) => re.test(cmd));
}

export function auditTddCompliance(toolCalls: ToolCallRecord[]): TddComplianceReport {
  const productionFilesBeforeTest: string[] = [];

  let firstTestWriteIdx: number | null = null;
  let firstProdWriteIdx: number | null = null;
  let firstTestRunIdx: number | null = null;
  let testRunCount = 0;

  toolCalls.forEach((c, idx) => {
    if (WRITE_TOOLS.has(c.tool)) {
      const p = c.args?.path;
      if (typeof p !== "string") return;
      if (isConfigFile(p)) return;

      if (isTestFile(p)) {
        if (firstTestWriteIdx === null) firstTestWriteIdx = idx;
        return;
      }

      if (isProdFile(p)) {
        if (firstProdWriteIdx === null) firstProdWriteIdx = idx;
        if (firstTestWriteIdx === null) productionFilesBeforeTest.push(p);
      }

      return;
    }

    if (c.tool === "bash") {
      const cmd = c.args?.command;
      if (typeof cmd !== "string") return;
      if (!isTestCommand(cmd)) return;

      testRunCount++;
      if (firstTestRunIdx === null) firstTestRunIdx = idx;
    }
  });

  const testWrittenFirst = productionFilesBeforeTest.length === 0;

  const testRanBeforeProduction =
    firstProdWriteIdx === null || (firstTestRunIdx !== null && firstTestRunIdx < firstProdWriteIdx);

  return {
    testWrittenFirst,
    testRanBeforeProduction,
    productionFilesBeforeTest,
    testRunCount,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tdd-auditor.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 6: Pipeline context builder (`buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`)

**Covers AC 10, 11, 12.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-context.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  appendStepOutput,
  setRetryContext,
  renderContextPrompt,
} from "../extensions/megapowers/subagent/pipeline-context.js";

describe("pipeline context", () => {
  it("builds initial context and appends step outputs", () => {
    let ctx = buildInitialContext({
      taskDescription: "Implement parser",
      planSection: "### Task 1: Parser",
      specContent: "AC1: ...",
      learnings: "Use bun test",
    });

    ctx = appendStepOutput(ctx, { step: "implement", filesChanged: ["src/a.ts"], finalOutput: "done" });
    ctx = setRetryContext(ctx, "Tests failed", ["Fix null check"]);

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Tests failed");
    expect(prompt).toContain("Fix null check");
  });

  it("accumulates review findings across multiple retry cycles (AC 12)", () => {
    let ctx = buildInitialContext({ taskDescription: "Task" });

    ctx = setRetryContext(ctx, "Cycle 1 failed", ["Finding A", "Finding B"]);
    ctx = setRetryContext(ctx, "Cycle 2 failed", ["Finding C"]);

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Finding A");
    expect(prompt).toContain("Finding B");
    expect(prompt).toContain("Finding C");
    expect(prompt).toContain("Cycle 2 failed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-context.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-context.ts`:

```ts
export interface PipelineStepOutput {
  step: "implement" | "verify" | "review";
  filesChanged: string[];
  testsPassed?: boolean | null;
  finalOutput?: string;
  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];
  tddReportJson?: string;
  error?: string;
}

export interface PipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;

  steps: PipelineStepOutput[];

  retryReason?: string;
  accumulatedReviewFindings: string[];
}

export function buildInitialContext(input: {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}): PipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
    steps: [],
    accumulatedReviewFindings: [],
  };
}

export function appendStepOutput(ctx: PipelineContext, step: PipelineStepOutput): PipelineContext {
  return { ...ctx, steps: [...ctx.steps, step] };
}

export function setRetryContext(ctx: PipelineContext, retryReason: string, findings?: string[]): PipelineContext {
  return {
    ...ctx,
    retryReason,
    accumulatedReviewFindings: [...ctx.accumulatedReviewFindings, ...(findings ?? [])],
  };
}

export function renderContextPrompt(ctx: PipelineContext): string {
  const sections: string[] = [];
  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Spec / Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.steps.length > 0) {
    const steps = ctx.steps.map((s) => {
      const lines: string[] = [];
      lines.push(`### ${s.step}`);
      if (s.filesChanged.length) lines.push(`Files changed: ${s.filesChanged.join(", ")}`);
      if (s.testsPassed !== undefined) lines.push(`Tests passed: ${String(s.testsPassed)}`);
      if (s.reviewVerdict) lines.push(`Review verdict: ${s.reviewVerdict}`);
      if (s.reviewFindings?.length) {
        lines.push(`Review findings:\n${s.reviewFindings.map((f) => `- ${f}`).join("\n")}`);
      }
      if (s.tddReportJson) lines.push(`TDD report: ${s.tddReportJson}`);
      if (s.error) lines.push(`Error: ${s.error}`);
      if (s.finalOutput) lines.push(`Output:\n\n${s.finalOutput}`);
      return lines.join("\n");
    });
    sections.push(`## Previous Steps\n\n${steps.join("\n\n")}`);
  }

  if (ctx.retryReason) sections.push(`## Retry Reason\n\n${ctx.retryReason}`);
  if (ctx.accumulatedReviewFindings.length > 0) {
    sections.push(`## Accumulated Review Findings\n\n${ctx.accumulatedReviewFindings.map((f) => `- ${f}`).join("\n")}`);
  }

  return sections.join("\n\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

(Tasks 7–20 unchanged from v5 plan on disk, except Task 11's `setRetryContext` call on review rejection now passes `verdict.findings` directly as `string[]`, and Task 16's implementer agent includes `megapowers_signal` in its tools list.)