# Plan: Subagent Pipeline (#084)

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
| 25, 28 | 14, 18 |
| 29–30 | 15 |
| 31–33 | 16 |
| 34 | 19 |

> Note: This plan also includes a required compatibility fix for **satellite mode detection / project-root resolution** for pi-subagents-spawned agents (pi-subagents sets `PI_SUBAGENT_DEPTH`, not `PI_SUBAGENT=1`). That change is implemented in Task 17 because it must be correct before the pipeline is runnable.

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
  // Find bash tool_use ids that correspond to test commands
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

  // Walk tool_result outputs; last matching determines status
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

  // Map tool_use_id -> index in calls (so we can attach output)
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

    // Task prompt should include context
    expect(captured.task).toContain("Do the work");
    expect(captured.task).toContain("## Context");
    expect(captured.task).toContain("extra ctx");

    // Overrides should be applied to the agent config used by runSync
    const impl = captured.agents.find((a: any) => a.name === "implementer");
    expect(impl.model).toBe("anthropic/claude-sonnet-4-5");
    expect(impl.thinking).toBe("high");
    expect(impl.tools).toEqual(["read", "write"]);
    expect(impl.systemPrompt).toContain("BASE");
    expect(impl.systemPrompt).toContain("OVERRIDE");

    // runSync options
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
        // Filled by higher-level parser; dispatcher keeps empty defaults
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
    ctx = setRetryContext(ctx, "Tests failed", "Fix null check");

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).toContain("src/a.ts");
    expect(prompt).toContain("Tests failed");
    expect(prompt).toContain("Fix null check");
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
  accumulatedReviewFindings?: string;
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
  };
}

export function appendStepOutput(ctx: PipelineContext, step: PipelineStepOutput): PipelineContext {
  return { ...ctx, steps: [...ctx.steps, step] };
}

export function setRetryContext(ctx: PipelineContext, retryReason: string, findings?: string): PipelineContext {
  return {
    ...ctx,
    retryReason,
    accumulatedReviewFindings: findings ?? ctx.accumulatedReviewFindings,
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
  if (ctx.accumulatedReviewFindings) {
    sections.push(`## Accumulated Review Findings\n\n${ctx.accumulatedReviewFindings}`);
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

## Task 7: Pipeline log (`writeLogEntry`, `readPipelineLog`) — JSONL

**Covers AC 23, 24.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-log.ts`
- Test: `tests/pipeline-log.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-log.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { writeLogEntry, readPipelineLog } from "../extensions/megapowers/subagent/pipeline-log.js";

describe("pipeline log", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "pipeline-log-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes JSONL entries under .megapowers/subagents/{id}/log.jsonl", () => {
    writeLogEntry(tmp, "pipe-1", {
      step: "implement",
      status: "completed",
      durationMs: 10,
      summary: "ok",
    });

    const p = join(tmp, ".megapowers", "subagents", "pipe-1", "log.jsonl");
    expect(existsSync(p)).toBe(true);

    const line = readFileSync(p, "utf-8").trim();
    const parsed = JSON.parse(line);
    expect(parsed.step).toBe("implement");
  });

  it("reads entries back in order", () => {
    writeLogEntry(tmp, "pipe-1", { step: "implement", status: "completed", durationMs: 1, summary: "a" });
    writeLogEntry(tmp, "pipe-1", { step: "verify", status: "failed", durationMs: 1, summary: "b", error: "boom" });

    const entries = readPipelineLog(tmp, "pipe-1");
    expect(entries).toHaveLength(2);
    expect(entries[1].error).toBe("boom");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-log.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-log.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-log.ts`:

```ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PipelineLogEntry {
  step: "implement" | "verify" | "review";
  status: "completed" | "failed" | "rejected";
  durationMs: number;
  summary: string;
  error?: string;
}

function logDir(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "subagents", pipelineId);
}

function logPath(projectRoot: string, pipelineId: string): string {
  return join(logDir(projectRoot, pipelineId), "log.jsonl");
}

export function writeLogEntry(projectRoot: string, pipelineId: string, entry: PipelineLogEntry): void {
  const dir = logDir(projectRoot, pipelineId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(logPath(projectRoot, pipelineId), JSON.stringify(entry) + "\n");
}

export function readPipelineLog(projectRoot: string, pipelineId: string): PipelineLogEntry[] {
  const p = logPath(projectRoot, pipelineId);
  if (!existsSync(p)) return [];
  const content = readFileSync(p, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((l) => JSON.parse(l));
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-log.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 8: jj workspace manager (create/squash/cleanup) (injectable `execJJ`)

**Covers AC 19, 20, 21, 22.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-workspace.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  pipelineWorkspaceName,
  pipelineWorkspacePath,
  type ExecJJ,
} from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("pipeline workspace", () => {
  it("creates workspace at .megapowers/subagents/{id}/workspace", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await createPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(r.workspaceName).toBe("mega-pipe-1");
    expect(r.workspacePath).toBe("/project/.megapowers/subagents/pipe-1/workspace");
    expect(calls[0].args).toEqual([
      "workspace",
      "add",
      "--name",
      "mega-pipe-1",
      "/project/.megapowers/subagents/pipe-1/workspace",
    ]);

    // Helpers are stable/pure
    expect(pipelineWorkspaceName("pipe-1")).toBe("mega-pipe-1");
    expect(pipelineWorkspacePath("/project", "pipe-1")).toBe("/project/.megapowers/subagents/pipe-1/workspace");
  });

  it("squashes from workspace and forgets", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    await squashPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(calls[0].args).toEqual(["squash", "--from", "mega-pipe-1@"]); 
    expect(calls[1].args).toEqual(["workspace", "forget", "mega-pipe-1"]);
  });

  it("cleanup forgets workspace and removes dir", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await cleanupPipelineWorkspace("/project", "pipe-1", execJJ);
    expect(r.error).toBeUndefined();
    expect(calls[0].args).toEqual(["workspace", "forget", "mega-pipe-1"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-workspace.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-workspace.ts`:

```ts
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

export interface ExecJJResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ExecJJ = (args: string[], opts?: { cwd?: string }) => Promise<ExecJJResult>;

export function pipelineWorkspaceName(pipelineId: string): string {
  return `mega-${pipelineId}`;
}

export function pipelineWorkspacePath(projectRoot: string, pipelineId: string): string {
  return join(projectRoot, ".megapowers", "subagents", pipelineId, "workspace");
}

export async function createPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  const r = await execJJ(["workspace", "add", "--name", workspaceName, workspacePath]);
  if (r.code !== 0) {
    return { workspaceName, workspacePath, error: r.stderr || `jj workspace add failed (code ${r.code})` };
  }

  return { workspaceName, workspacePath };
}

export async function squashPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);

  const squash = await execJJ(["squash", "--from", `${workspaceName}@`]);
  if (squash.code !== 0) return { error: squash.stderr || `squash failed (code ${squash.code})` };

  const forget = await execJJ(["workspace", "forget", workspaceName]);
  if (forget.code !== 0) return { error: forget.stderr || `workspace forget failed (code ${forget.code})` };

  return {};
}

export async function cleanupPipelineWorkspace(projectRoot: string, pipelineId: string, execJJ: ExecJJ) {
  const workspaceName = pipelineWorkspaceName(pipelineId);
  const workspacePath = pipelineWorkspacePath(projectRoot, pipelineId);

  const forget = await execJJ(["workspace", "forget", workspaceName]);

  // Always remove dir
  if (existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });

  if (forget.code !== 0) {
    return { error: forget.stderr || `workspace forget failed (code ${forget.code})` };
  }

  return {};
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 9: Workspace diff helpers (`getWorkspaceDiff`) [depends: 8]

**Covers AC 19–22 (diff helper used by pause/escalation) and supports AC 7.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-diff.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-diff.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getWorkspaceDiff, type ExecJJ } from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("getWorkspaceDiff", () => {
  it("gets diff by running jj diff in workspace cwd and parses --summary", async () => {
    const calls: any[] = [];
    const execJJ: ExecJJ = async (args, opts) => {
      calls.push({ args, opts });
      if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "M src/a.ts\nA src/b.ts\n", stderr: "" };
      if (args[0] === "diff") return { code: 0, stdout: "diff --git ...", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    };

    const r = await getWorkspaceDiff("/project/.megapowers/subagents/pipe-1/workspace", execJJ);
    expect(r.filesChanged).toEqual(["src/a.ts", "src/b.ts"]);
    expect(r.diff).toContain("diff --git");

    // Must run in the workspace cwd
    expect(calls[0].opts?.cwd).toBe("/project/.megapowers/subagents/pipe-1/workspace");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-diff.test.ts`

Expected: FAIL — `getWorkspaceDiff` is not exported / is not a function

**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/subagent/pipeline-workspace.ts` by appending:

```ts
function parseSummaryFiles(summary: string): string[] {
  // jj diff --summary lines: "M path", "A path", ...
  return summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[A-Z]\s+/, ""));
}

export async function getWorkspaceDiff(
  workspaceCwd: string,
  execJJ: ExecJJ,
): Promise<{ filesChanged: string[]; diff: string }> {
  const summary = await execJJ(["diff", "--summary"], { cwd: workspaceCwd });
  const full = await execJJ(["diff"], { cwd: workspaceCwd });

  return {
    filesChanged: parseSummaryFiles(summary.stdout),
    diff: full.stdout,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-diff.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 10: Result parser (`parseStepResult`, `parseReviewVerdict`) — derives from messages

**Covers AC 17, 18.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-results.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { parseStepResult, parseReviewVerdict } from "../extensions/megapowers/subagent/pipeline-results.js";
import type { DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

describe("parseStepResult", () => {
  it("extracts filesChanged/testsPassed/finalOutput from messages", () => {
    const dispatch: DispatchResult = {
      exitCode: 0,
      messages: [
        {
          role: "assistant" as const,
          content: [
            { type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts", content: "x" } },
            { type: "tool_use" as const, id: "2", name: "bash", input: { command: "bun test" } },
          ],
        },
        {
          role: "tool" as const,
          content: [{ type: "tool_result" as const, tool_use_id: "2", content: "1 pass\n0 fail" }],
        },
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "All done" }],
        },
      ] as any,
      filesChanged: [],
      testsPassed: null,
    };

    const r = parseStepResult(dispatch);
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.testsPassed).toBe(true);
    expect(r.finalOutput).toContain("All done");
  });
});

describe("parseReviewVerdict", () => {
  it("parses approve/reject and findings", () => {
    const v1 = parseReviewVerdict("Verdict: approve");
    expect(v1.verdict).toBe("approve");

    const v2 = parseReviewVerdict("Verdict: reject\n\n## Findings\n- Missing test\n- Bug");
    expect(v2.verdict).toBe("reject");
    expect(v2.findings).toEqual(["Missing test", "Bug"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-results.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-results.ts`:

```ts
import type { DispatchResult } from "./dispatcher.js";
import { extractFilesChanged, extractFinalOutput, extractTestsPassed } from "./message-utils.js";

export interface StepResult {
  filesChanged: string[];
  testsPassed: boolean | null;
  finalOutput: string;
  error?: string;
}

export function parseStepResult(dispatch: DispatchResult): StepResult {
  return {
    filesChanged: extractFilesChanged(dispatch.messages),
    testsPassed: extractTestsPassed(dispatch.messages),
    finalOutput: extractFinalOutput(dispatch.messages),
    error: dispatch.exitCode === 0 ? undefined : dispatch.error ?? "Non-zero exit code",
  };
}

export interface ReviewVerdict {
  verdict: "approve" | "reject";
  findings: string[];
}

export function parseReviewVerdict(text: string): ReviewVerdict {
  const approve = /verdict\s*[:\-]?\s*approve/i.test(text);
  const reject = /verdict\s*[:\-]?\s*reject/i.test(text);

  const verdict: "approve" | "reject" = approve && !reject ? "approve" : "reject";

  const findings: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^[-*]\s+(.+)/);
    if (m) findings.push(m[1].trim());
  }

  return { verdict, findings };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 11: Pipeline runner (`runPipeline`) — retries, timeouts, log, diff, pause/completed [depends: 3, 5, 6, 7, 9, 10]

**Covers AC 4–9 and AC 16.**

**Revision note:** This task explicitly returns **(a)** accumulated log entries in paused results (AC7) and **(b)** verifier test output in completed results (AC8).

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-runner.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { runPipeline } from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

function mkDispatch(exitCode: number, extra?: Partial<DispatchResult>): DispatchResult {
  return {
    exitCode,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    ...extra,
  };
}

describe("runPipeline", () => {
  it("happy path: implement -> verify(pass) -> review(approve) => completed (includes test output)", async () => {
    const called: string[] = [];

    const dispatcher: Dispatcher = {
      async dispatch(cfg: DispatchConfig) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts" } }],
              },
            ] as any,
          });
        }
        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }],
              },
              {
                role: "tool" as const,
                content: [{ type: "tool_result" as const, tool_use_id: "t", content: "1 pass\n0 fail" }],
              },
              {
                role: "assistant" as const,
                content: [{ type: "text" as const, text: "RAW TEST OUTPUT: 1 pass / 0 fail" }],
              },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] },
            ] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      {
        taskDescription: "Do task",
        planSection: "### Task 1",
      },
      dispatcher,
      {
        projectRoot: "/project",
        workspaceCwd: "/project/.megapowers/subagents/pipe/workspace",
        pipelineId: "pipe",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        execJJ: async (args, opts) => {
          if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "M src/a.ts\n", stderr: "" };
          if (args[0] === "diff") return { code: 0, stdout: "diff --git ...", stderr: "" };
          return { code: 0, stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.reviewVerdict).toBe("approve");
    expect(r.testOutput).toContain("RAW TEST OUTPUT");
    expect(called).toEqual(["implementer", "verifier", "reviewer"]);
  });

  it("verify failure retries implement->verify and pauses after budget exhausted (includes accumulated log)", async () => {
    let implCount = 0;
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          return mkDispatch(0, { messages: [] as any });
        }
        if (cfg.agent === "verifier") {
          return mkDispatch(0, {
            messages: [
              {
                role: "assistant" as const,
                content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }],
              },
              {
                role: "tool" as const,
                content: [{ type: "tool_result" as const, tool_use_id: "t", content: "0 pass\n1 fail" }],
              },
            ] as any,
          });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant", content: [{ type: "text", text: "Verdict: approve" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot: "/project",
        workspaceCwd: "/ws",
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 1,
        execJJ: async (args) => {
          if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "", stderr: "" };
          if (args[0] === "diff") return { code: 0, stdout: "diff --git ...", stderr: "" };
          return { code: 0, stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(implCount).toBe(2); // 1 initial + 1 retry
    expect(r.errorSummary).toContain("Retry budget exhausted");
    expect(r.diff).toContain("diff --git");
    expect(Array.isArray(r.logEntries)).toBe(true);
  });

  it("timeout errors count toward retry budget", async () => {
    let tries = 0;
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          tries++;
          throw new Error("TimeoutError: step exceeded timeout");
        }
        return mkDispatch(0, { messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot: "/project",
        workspaceCwd: "/ws",
        pipelineId: "p",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        maxRetries: 0,
        execJJ: async (args) => {
          if (args[0] === "diff" && args[1] === "--summary") return { code: 0, stdout: "", stderr: "" };
          if (args[0] === "diff") return { code: 0, stdout: "", stderr: "" };
          return { code: 0, stdout: "", stderr: "" };
        },
      },
    );

    expect(tries).toBe(1);
    expect(r.status).toBe("paused");
    expect(r.errorSummary).toContain("TimeoutError");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-runner.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-runner.ts`:

```ts
import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import { buildInitialContext, appendStepOutput, setRetryContext, renderContextPrompt } from "./pipeline-context.js";
import { parseStepResult, parseReviewVerdict } from "./pipeline-results.js";
import { writeLogEntry, readPipelineLog, type PipelineLogEntry } from "./pipeline-log.js";
import { extractToolCalls } from "./message-utils.js";
import { auditTddCompliance } from "./tdd-auditor.js";
import { getWorkspaceDiff, type ExecJJ } from "./pipeline-workspace.js";

export interface PipelineAgents {
  implementer: string;
  verifier: string;
  reviewer: string;
}

export interface PipelineOptions {
  projectRoot: string;
  workspaceCwd: string;
  pipelineId: string;
  agents: PipelineAgents;

  maxRetries?: number;
  stepTimeoutMs?: number;

  execJJ: ExecJJ;
}

export type PipelineStatus = "completed" | "paused";

export interface PipelineResult {
  status: PipelineStatus;
  filesChanged: string[];

  testsPassed?: boolean | null;
  testOutput?: string;

  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];

  retryCount: number;

  // Required by AC7 when paused
  logEntries?: PipelineLogEntry[];
  diff?: string;
  errorSummary?: string;
}

function asDispatchFailure(err: unknown): DispatchResult {
  return {
    exitCode: 1,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

async function safeDispatch(dispatcher: Dispatcher, cfg: DispatchConfig): Promise<DispatchResult> {
  try {
    return await dispatcher.dispatch(cfg);
  } catch (err) {
    return asDispatchFailure(err);
  }
}

export async function runPipeline(
  input: { taskDescription: string; planSection?: string; specContent?: string; learnings?: string },
  dispatcher: Dispatcher,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const maxRetries = options.maxRetries ?? 3;
  const stepTimeoutMs = options.stepTimeoutMs ?? 10 * 60 * 1000;

  let retryCount = 0;
  let filesChanged: string[] = [];

  let ctx = buildInitialContext(input);

  for (let cycle = 0; cycle <= maxRetries; cycle++) {
    // ---------------- implement ----------------
    const t0 = Date.now();
    const impl = await safeDispatch(dispatcher, {
      agent: options.agents.implementer,
      task: input.taskDescription,
      cwd: options.workspaceCwd,
      context: cycle === 0 ? undefined : renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const implParsed = parseStepResult(impl);
    filesChanged = [...new Set([...filesChanged, ...implParsed.filesChanged])];

    // TDD audit after implement (AC16)
    const toolCalls = extractToolCalls(impl.messages);
    const tddReport = auditTddCompliance(toolCalls);

    ctx = appendStepOutput(ctx, {
      step: "implement",
      filesChanged: implParsed.filesChanged,
      finalOutput: implParsed.finalOutput,
      error: implParsed.error,
      tddReportJson: JSON.stringify(tddReport),
    });

    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "implement",
      status: impl.exitCode === 0 ? "completed" : "failed",
      durationMs: Date.now() - t0,
      summary: impl.exitCode === 0 ? "implement ok" : "implement failed",
      error: implParsed.error,
    });

    if (impl.exitCode !== 0) {
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execJJ);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — implement failed: ${implParsed.error ?? "unknown"}`,
        };
      }
      ctx = setRetryContext(ctx, `Implement failed: ${implParsed.error ?? "unknown"}`);
      continue;
    }

    // ---------------- verify ----------------
    const t1 = Date.now();
    const verify = await safeDispatch(dispatcher, {
      agent: options.agents.verifier,
      task: "Run the test suite and report pass/fail with output",
      cwd: options.workspaceCwd,
      context: renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const verifyParsed = parseStepResult(verify);

    ctx = appendStepOutput(ctx, {
      step: "verify",
      filesChanged: verifyParsed.filesChanged,
      finalOutput: verifyParsed.finalOutput,
      testsPassed: verifyParsed.testsPassed,
      error: verifyParsed.error,
    });

    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "verify",
      status: verifyParsed.testsPassed ? "completed" : "failed",
      durationMs: Date.now() - t1,
      summary: verifyParsed.testsPassed ? "tests passed" : "tests failed",
      error: verifyParsed.error,
    });

    if (!verifyParsed.testsPassed) {
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execJJ);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: "Retry budget exhausted — tests still failing",
        };
      }
      ctx = setRetryContext(ctx, `Verify failed: ${verifyParsed.finalOutput || verifyParsed.error || "unknown"}`);
      continue;
    }

    // ---------------- review ----------------
    const t2 = Date.now();
    const review = await safeDispatch(dispatcher, {
      agent: options.agents.reviewer,
      task: "Review the implementation against the spec and the provided context. End with Verdict: approve|reject and bullet findings.",
      cwd: options.workspaceCwd,
      context: renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const reviewParsed = parseStepResult(review);
    const verdict = parseReviewVerdict(reviewParsed.finalOutput);

    ctx = appendStepOutput(ctx, {
      step: "review",
      filesChanged: [],
      finalOutput: reviewParsed.finalOutput,
      reviewVerdict: verdict.verdict,
      reviewFindings: verdict.findings,
      error: reviewParsed.error,
    });

    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "review",
      status: verdict.verdict === "approve" ? "completed" : "rejected",
      durationMs: Date.now() - t2,
      summary: `verdict: ${verdict.verdict}`,
      error: verdict.verdict === "reject" ? verdict.findings.join("; ") : undefined,
    });

    if (verdict.verdict === "approve") {
      return {
        status: "completed",
        filesChanged,
        retryCount,
        testsPassed: true,
        testOutput: verifyParsed.finalOutput,
        reviewVerdict: "approve",
        reviewFindings: verdict.findings,
      };
    }

    // rejected
    retryCount++;
    if (cycle >= maxRetries) {
      const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execJJ);
      return {
        status: "paused",
        filesChanged,
        retryCount,
        logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
        diff,
        errorSummary: "Retry budget exhausted — review still rejecting",
      };
    }

    ctx = setRetryContext(ctx, `Review rejected`, verdict.findings.join("\n"));
  }

  const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execJJ);
  return {
    status: "paused",
    filesChanged,
    retryCount,
    logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
    diff,
    errorSummary: "Unexpected pipeline exit",
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 12: Dependency validator (`validateTaskDependencies`) [depends: none]

**Covers AC 26.**

**Files:**
- Create: `extensions/megapowers/subagent/task-deps.ts`
- Test: `tests/task-deps.test.ts`

**Step 1 — Write the failing test**
Create `tests/task-deps.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { validateTaskDependencies } from "../extensions/megapowers/subagent/task-deps.js";
import type { PlanTask } from "../extensions/megapowers/state/state-machine.js";

describe("validateTaskDependencies", () => {
  it("returns valid when task has no dependencies", () => {
    const tasks: PlanTask[] = [{ index: 1, description: "x" } as any];
    expect(validateTaskDependencies(1, tasks, [])).toEqual({ valid: true });
  });

  it("returns unmetDependencies when deps incomplete", () => {
    const tasks: PlanTask[] = [{ index: 2, description: "x", dependsOn: [1, 3] } as any];
    const r = validateTaskDependencies(2, tasks, [1]);
    expect(r.valid).toBe(false);
    expect(r.unmetDependencies).toEqual([3]);
  });

  it("returns error when task missing", () => {
    const tasks: PlanTask[] = [{ index: 1, description: "x" } as any];
    const r = validateTaskDependencies(2, tasks, []);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("not found");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/task-deps.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/task-deps.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/task-deps.ts`:

```ts
import type { PlanTask } from "../state/state-machine.js";

export interface ValidationResult {
  valid: boolean;
  unmetDependencies?: number[];
  error?: string;
}

export function validateTaskDependencies(
  taskIndex: number,
  tasks: PlanTask[],
  completedTaskIndices: number[],
): ValidationResult {
  if (tasks.length === 0) {
    return { valid: false, error: "No tasks found in plan. Ensure plan.md exists and has parseable tasks." };
  }

  const task = tasks.find((t) => t.index === taskIndex);
  if (!task) {
    return { valid: false, error: `Task ${taskIndex} not found in plan.` };
  }

  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { valid: true };
  }

  const completedSet = new Set(completedTaskIndices);
  const unmet = task.dependsOn.filter((dep) => !completedSet.has(dep));

  if (unmet.length > 0) {
    return { valid: false, unmetDependencies: unmet };
  }

  return { valid: true };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/task-deps.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 13: Pipeline resume metadata store (`pipeline-meta`) [depends: none]

**Covers AC 27 (resume without adding new required tool inputs).**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-meta.ts`
- Test: `tests/pipeline-meta.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-meta.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { writePipelineMeta, readPipelineMeta, clearPipelineMeta } from "../extensions/megapowers/subagent/pipeline-meta.js";

describe("pipeline meta", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "pipeline-meta-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes/reads/clears meta per taskIndex", () => {
    writePipelineMeta(tmp, 1, { pipelineId: "p1", workspacePath: "/ws", createdAt: 123 });

    const m = readPipelineMeta(tmp, 1);
    expect(m?.pipelineId).toBe("p1");

    clearPipelineMeta(tmp, 1);
    expect(readPipelineMeta(tmp, 1)).toBeNull();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-meta.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-meta.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-meta.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PipelineMeta {
  pipelineId: string;
  workspacePath: string;
  createdAt: number;
}

function metaDir(projectRoot: string): string {
  return join(projectRoot, ".megapowers", "subagents");
}

function metaPath(projectRoot: string, taskIndex: number): string {
  return join(metaDir(projectRoot), `task-${taskIndex}-pipeline.json`);
}

export function writePipelineMeta(projectRoot: string, taskIndex: number, meta: PipelineMeta): void {
  const dir = metaDir(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(metaPath(projectRoot, taskIndex), JSON.stringify(meta, null, 2));
}

export function readPipelineMeta(projectRoot: string, taskIndex: number): PipelineMeta | null {
  const p = metaPath(projectRoot, taskIndex);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function clearPipelineMeta(projectRoot: string, taskIndex: number): void {
  const p = metaPath(projectRoot, taskIndex);
  if (existsSync(p)) rmSync(p, { force: true });
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-meta.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 14: Pipeline tool handler (`pipeline`) — taskIndex validation, resume, squash+task_done, paused returns log+diff+error [depends: 8, 11, 12, 13]

**Covers AC 25, 26, 27, 28.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`

**Step 1 — Write the failing test**
Create `tests/pipeline-tool.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handlePipelineTool } from "../extensions/megapowers/subagent/pipeline-tool.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";

function setup() {
  const tmp = mkdtempSync(join(tmpdir(), "pipe-tool-"));

  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "implement",
    megaEnabled: true,
    currentTaskIndex: 0,
    completedTasks: [],
  });

  const planDir = join(tmp, ".megapowers", "plans", "001-test");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "plan.md"), `# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

  return tmp;
}

describe("handlePipelineTool", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = setup();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects when taskIndex is not the current task", async () => {
    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(r.error).toContain("current task");
  });

  it("on completed pipeline, squashes workspace and marks task done", async () => {
    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent.includes("review")) {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        // verifier returns passing output
        if (cfg.agent.includes("verify")) {
          return {
            exitCode: 0,
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "1 pass\n0 fail" }] },
            ] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        // implement writes a file
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execJJ);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");

    // squash called
    expect(jjCalls.some((c) => c.args[0] === "squash")).toBe(true);

    // task marked done
    const state = readState(tmp);
    expect(state.completedTasks).toContain(1);
  });

  it("supports resume by reusing previous workspace (no new workspace add)", async () => {
    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    let call = 0;
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        call++;

        if (cfg.agent.includes("verify")) {
          // Always fail verify so pipeline pauses
          return {
            exitCode: 0,
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t", name: "bash", input: { command: "bun test" } }] },
              { role: "tool" as const, content: [{ type: "tool_result" as const, tool_use_id: "t", content: "0 pass\n1 fail" }] },
            ] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        if (cfg.agent.includes("review")) {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        return { exitCode: 0, messages: [] as any, filesChanged: [], testsPassed: null };
      },
    };

    const first = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execJJ);
    expect(first.result?.status).toBe("paused");

    const adds = jjCalls.filter((c) => c.args[0] === "workspace" && c.args[1] === "add").length;

    const second = await handlePipelineTool(tmp, { taskIndex: 1, resume: true, guidance: "try again" }, dispatcher, execJJ);
    expect(second.result?.status).toBe("paused");

    const addsAfter = jjCalls.filter((c) => c.args[0] === "workspace" && c.args[1] === "add").length;

    // resume should not create a new workspace
    expect(addsAfter).toBe(adds);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-tool.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/pipeline-tool.ts`:

```ts
import type { Dispatcher } from "./dispatcher.js";
import { readState } from "../state/state-io.js";
import { deriveTasks } from "../state/derived.js";
import { createStore } from "../state/store.js";
import { handleSignal } from "../tools/tool-signal.js";

import { createPipelineWorkspace, squashPipelineWorkspace, type ExecJJ } from "./pipeline-workspace.js";
import { runPipeline } from "./pipeline-runner.js";
import { validateTaskDependencies } from "./task-deps.js";
import { writePipelineMeta, readPipelineMeta, clearPipelineMeta } from "./pipeline-meta.js";

export interface PipelineToolInput {
  taskIndex: number;
  resume?: boolean;
  guidance?: string;
}

export interface PipelineToolOutput {
  pipelineId?: string;
  result?: any;
  paused?: { diff?: string; log?: any[]; errorSummary?: string };
  error?: string;
}

function extractTaskSection(planMd: string, taskIndex: number): string | undefined {
  const re = new RegExp(`^###\\s+Task\\s+${taskIndex}:[\\s\\S]*?(?=^###\\s+Task\\s+|\\n?$)`, "m");
  const m = planMd.match(re);
  return m?.[0]?.trim();
}

export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execJJ: ExecJJ,
): Promise<PipelineToolOutput> {
  const state = readState(projectRoot);

  if (!state.megaEnabled) return { error: "Megapowers is disabled." };
  if (!state.activeIssue) return { error: "No active issue." };
  if (state.phase !== "implement") return { error: "pipeline tool can only run during implement phase." };

  const tasks = deriveTasks(projectRoot, state.activeIssue);
  const currentTask = tasks[state.currentTaskIndex];
  if (!currentTask) return { error: "No current task found." };

  // Safety: task_done operates on currentTaskIndex; enforce match.
  if (input.taskIndex !== currentTask.index) {
    return {
      error: `Task ${input.taskIndex} is not the current task (${currentTask.index}). Switch tasks before running pipeline.`,
    };
  }

  const dep = validateTaskDependencies(currentTask.index, tasks as any, state.completedTasks);
  if (!dep.valid) {
    return {
      error: dep.error ?? `Task ${currentTask.index} depends on incomplete tasks: ${(dep.unmetDependencies ?? []).join(", ")}`,
    };
  }

  // Resume uses the previously-stored pipelineId/workspacePath.
  // Non-resume creates a new pipelineId/workspacePath.
  let pipelineId: string;
  let workspacePath: string;

  if (input.resume) {
    const meta = readPipelineMeta(projectRoot, currentTask.index);
    if (!meta) return { error: `No paused pipeline found for task ${currentTask.index}.` };
    pipelineId = meta.pipelineId;
    workspacePath = meta.workspacePath;
  } else {
    pipelineId = `pipe-t${currentTask.index}-${Date.now()}`;

    const ws = await createPipelineWorkspace(projectRoot, pipelineId, execJJ);
    if ((ws as any).error) return { error: `Workspace creation failed: ${(ws as any).error}` };
    workspacePath = ws.workspacePath;
  }

  const store = createStore(projectRoot);
  const planMd = store.readPlanFile(state.activeIssue, "plan.md") ?? "";
  const planSection = extractTaskSection(planMd, currentTask.index);

  const specFile = state.workflow === "bugfix" ? "diagnosis.md" : "spec.md";
  const specContent = store.readPlanFile(state.activeIssue, specFile) ?? undefined;
  const learnings = store.getLearnings() || undefined;

  const taskDescription = input.guidance
    ? `${currentTask.description}\n\n## Guidance\n\n${input.guidance}`
    : currentTask.description;

  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", verifier: "verifier", reviewer: "pipeline-reviewer" },
      execJJ,
    },
  );

  if (result.status === "completed") {
    const squash = await squashPipelineWorkspace(projectRoot, pipelineId, execJJ);
    if ((squash as any).error) return { error: `Squash failed: ${(squash as any).error}`, pipelineId, result };

    clearPipelineMeta(projectRoot, currentTask.index);

    const signal = handleSignal(projectRoot, "task_done");
    if (signal.error) return { error: `task_done failed: ${signal.error}`, pipelineId, result };

    return { pipelineId, result };
  }

  // paused: store meta so resume can reuse workspace
  writePipelineMeta(projectRoot, currentTask.index, { pipelineId, workspacePath, createdAt: Date.now() });

  return {
    pipelineId,
    result,
    paused: {
      diff: result.diff,
      log: result.logEntries,
      errorSummary: result.errorSummary,
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 15: One-shot subagent tool handler (`subagent`) — single dispatch in workspace

**Covers AC 29, 30.**

**Files:**
- Create: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**
Create `tests/oneshot-tool.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { handleOneshotTool } from "../extensions/megapowers/subagent/oneshot-tool.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";

describe("handleOneshotTool", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "oneshot-"));
    writeState(tmp, { ...createInitialState(), megaEnabled: true, phase: "implement", activeIssue: "001" });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("squashes workspace on success", async () => {
    const jjCalls: any[] = [];
    const execJJ = async (args: string[], opts?: any) => {
      jjCalls.push({ args, opts });
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch() {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "ok" }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handleOneshotTool(tmp, { task: "do it" }, dispatcher, execJJ);
    expect(r.error).toBeUndefined();
    expect(jjCalls.some((c) => c.args[0] === "squash")).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`

Expected: FAIL — cannot find module `../extensions/megapowers/subagent/oneshot-tool.js`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/subagent/oneshot-tool.ts`:

```ts
import type { Dispatcher } from "./dispatcher.js";
import { readState } from "../state/state-io.js";
import { createPipelineWorkspace, squashPipelineWorkspace, cleanupPipelineWorkspace, type ExecJJ } from "./pipeline-workspace.js";
import { parseStepResult } from "./pipeline-results.js";

export interface OneshotToolInput {
  task: string;
  agent?: string;
  timeoutMs?: number;
}

export interface OneshotToolOutput {
  id: string;
  output?: string;
  filesChanged?: string[];
  error?: string;
}

export async function handleOneshotTool(
  projectRoot: string,
  input: OneshotToolInput,
  dispatcher: Dispatcher,
  execJJ: ExecJJ,
): Promise<OneshotToolOutput> {
  const state = readState(projectRoot);
  if (!state.megaEnabled) return { id: "", error: "Megapowers is disabled." };

  const id = `oneshot-${Date.now()}`;

  const ws = await createPipelineWorkspace(projectRoot, id, execJJ);
  if ((ws as any).error) return { id, error: `Workspace creation failed: ${(ws as any).error}` };

  const dispatch = await dispatcher.dispatch({
    agent: input.agent ?? "worker",
    task: input.task,
    cwd: ws.workspacePath,
    timeoutMs: input.timeoutMs,
  });

  const parsed = parseStepResult(dispatch);

  if (dispatch.exitCode === 0) {
    await squashPipelineWorkspace(projectRoot, id, execJJ);
  } else {
    await cleanupPipelineWorkspace(projectRoot, id, execJJ);
  }

  return {
    id,
    output: parsed.finalOutput || undefined,
    filesChanged: parsed.filesChanged.length ? parsed.filesChanged : undefined,
    error: dispatch.exitCode === 0 ? undefined : dispatch.error ?? parsed.error,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/oneshot-tool.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 16: Add pipeline agents (`implementer`, `pipeline-reviewer`, `verifier`) [no-test]

**Justification:** Agent prompt markdown files.

**Covers AC 31, 32, 33.**

**Files:**
- Create: `.pi/agents/implementer.md`
- Create: `.pi/agents/pipeline-reviewer.md`
- Create: `.pi/agents/verifier.md`

**Step 1 — Make the change**

Create `.pi/agents/implementer.md`:

```md
---
name: implementer
description: Implementation agent (TDD)
model: openai/gpt-5.3-codex
tools: read, write, edit, bash, grep, find, ls
thinking: low
---

You are an implementation agent executing a single task.

## TDD (strict)
1. Write/modify a test first
2. Run that test and confirm it FAILS
3. Implement minimal production code
4. Re-run the test and confirm it PASSES
5. Run `bun test` and confirm no regressions

If the task is explicitly marked [no-test], you may skip steps 1–2.
```

Create `.pi/agents/pipeline-reviewer.md`:

```md
---
name: pipeline-reviewer
description: Pipeline code reviewer
model: anthropic/claude-sonnet-4-5
tools: read, bash, grep, find, ls
thinking: high
---

Review the implementation against the spec and the provided context, including the TDD compliance report.

## Output requirements
End with exactly one of:

**Verdict: approve**
**Verdict: reject**

If rejecting, include a `## Findings` section with bullet points:
- [blocking] file:line — description
- [suggestion] ...

Do not modify any files.
```

Create `.pi/agents/verifier.md`:

```md
---
name: verifier
description: Runs tests and reports results
model: anthropic/claude-haiku-4-5
tools: bash, read, grep
thinking: low
---

Run `bun test` and report pass/fail. Include the raw output.
Do not modify any files.
```

**Step 2 — Verify**
Run: `bunx tsc --noEmit`

Expected: no type errors.

---

## Task 17: Satellite compatibility for pi-subagents (`PI_SUBAGENT_DEPTH`) + project-root resolution
**Covers:** required compatibility note (not explicitly in AC list, but required for pipeline to run in subagent-spawned sessions).
**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Modify: `tests/satellite-root.test.ts`
Replace `tests/satellite-root.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolveProjectRoot, isSatelliteMode } from "../extensions/megapowers/satellite.js";

describe("resolveProjectRoot", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mega-root-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns MEGA_PROJECT_ROOT when set", () => {
    const resolved = resolveProjectRoot("/some/cwd", { MEGA_PROJECT_ROOT: "/project" });
    expect(resolved).toBe("/project");
  });
it("walks up from cwd to find .megapowers/state.json when MEGA_PROJECT_ROOT is not set", () => {
    mkdirSync(join(root, ".megapowers"), { recursive: true });
    writeFileSync(join(root, ".megapowers", "state.json"), "{}", "utf-8");

    const cwd = join(root, ".megapowers", "subagents", "p1", "workspace");
    mkdirSync(cwd, { recursive: true });

    const resolved = resolveProjectRoot(cwd, {});
    expect(resolved).toBe(root);
  });

  it("falls back to cwd when no state.json exists in parents", () => {
    const cwd = join(root, "no-state", "deep");
    mkdirSync(cwd, { recursive: true });

    const resolved = resolveProjectRoot(cwd, {});
    expect(resolved).toBe(cwd);
  });
});

describe("isSatelliteMode", () => {
  it("treats PI_SUBAGENT=1 as satellite mode (legacy)", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT: "1" } })).toBe(true);
  });
it("treats PI_SUBAGENT_DEPTH=1 as satellite mode", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT_DEPTH: "1" } })).toBe(true);
  });

  it("does not treat PI_SUBAGENT_DEPTH=0 as satellite mode", () => {
    expect(isSatelliteMode({ isTTY: false, env: { PI_SUBAGENT_DEPTH: "0" } })).toBe(false);
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/satellite-root.test.ts`

Expected: FAIL — PI_SUBAGENT_DEPTH is not recognized, and resolveProjectRoot does not walk up to find `.megapowers/state.json`.
**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/satellite.ts`:
1) Add imports near the top:

```ts
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
```

2) Replace `isSatelliteMode()` with:

```ts
export function isSatelliteMode(ctx: SatelliteDetectionContext): boolean {
  // Legacy signal (older subagent extension)
  if (ctx.env.PI_SUBAGENT === "1") return true;

  // pi-subagents signal
  const depth = ctx.env.PI_SUBAGENT_DEPTH;
  return typeof depth === "string" && depth.length > 0 && depth !== "0";
}
```

3) Replace `resolveProjectRoot()` with:

```ts
function hasMegapowersStateJson(dir: string): boolean {
  return existsSync(join(dir, ".megapowers", "state.json"));
}

export function resolveProjectRoot(
  cwd: string,
  env: Record<string, string | undefined>,
): string {
  const projectRoot = env.MEGA_PROJECT_ROOT;
  if (projectRoot && projectRoot.length > 0) return projectRoot;

  // Walk up from cwd so satellites inside .megapowers/subagents/.../workspace can
  // still locate the primary state.json.
  let current = cwd;
  while (true) {
    if (hasMegapowersStateJson(current)) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return cwd;
}
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/satellite-root.test.ts`

Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---


## Task 18: Tool wiring — register `pipeline`, update `subagent`, remove `subagent_status`

**Covers AC 25 and supports AC 28.**

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/tools-wiring.test.ts`

**Step 1 — Write the failing test**
Create `tests/tools-wiring.test.ts`:

```ts
import { describe, it, expect } from "bun:test";

describe("tool wiring", () => {
  it("register-tools wires pipeline tool and removes subagent_status", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const toolsSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "register-tools.ts"), "utf-8");
    expect(toolsSource).toContain('name: "pipeline"');
    expect(toolsSource).toContain('name: "subagent"');
    expect(toolsSource).not.toContain('name: "subagent_status"');
  });

  it("/mega off filtering mentions pipeline tool", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const commandsSource = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");
    expect(commandsSource).toContain('"pipeline"');
    expect(commandsSource).not.toContain('"subagent_status"');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tools-wiring.test.ts`

Expected: FAIL — register-tools.ts does not include pipeline tool; commands.ts still references subagent_status.

**Step 3 — Write minimal implementation**
### 3a) Update `/mega off` + `/mega on` tool filtering

Modify `extensions/megapowers/commands.ts`:

1) In the `/mega off` handler, replace the filter list so it hides `pipeline` (and removes `subagent_status`):

```ts
const activeTools = deps.pi.getActiveTools().filter(
  (t: string) =>
    t !== "megapowers_signal" &&
    t !== "megapowers_save_artifact" &&
    t !== "subagent" &&
    t !== "pipeline",
);
```

2) In the `/mega on` handler, replace `toolsToAdd` so it restores `pipeline` (and removes `subagent_status`):

```ts
const toolsToAdd = ["megapowers_signal", "megapowers_save_artifact", "subagent", "pipeline"];
```

### 3b) Register `pipeline` and update `subagent` to one-shot mode

Modify `extensions/megapowers/register-tools.ts`:

1) Replace the old subagent imports:

Remove these imports:

```ts
import { handleSubagentDispatch, handleSubagentStatus } from "./subagent/subagent-tools.js";
import { writeSubagentStatus, updateSubagentStatus } from "./subagent/subagent-status.js";
import { buildSpawnArgs, buildSpawnEnv, createRunnerState, processJsonlLine } from "./subagent/subagent-runner.js";
import { buildWorkspaceName, buildWorkspaceAddArgs, buildWorkspaceForgetArgs, buildDiffSummaryArgs, buildDiffFullArgs } from "./subagent/subagent-workspace.js";
import { detectRepeatedErrors } from "./subagent/subagent-errors.js";
```

Add these imports:

```ts
import { handlePipelineTool } from "./subagent/pipeline-tool.js";
import { handleOneshotTool } from "./subagent/oneshot-tool.js";
import { PiSubagentsDispatcher } from "./subagent/pi-subagents-dispatcher.js";
import { runSync } from "pi-subagents/execution.js";
import { discoverAgents } from "pi-subagents/agents.js";
```

2) Replace the existing `subagent` tool registration block with a one-shot version:

```ts
pi.registerTool({
  name: "subagent",
  label: "Subagent",
  description: "Run a one-shot subagent task in an isolated jj workspace and squash changes back on success.",
  parameters: Type.Object({
    task: Type.String({ description: "Task description for the subagent" }),
    agent: Type.Optional(Type.String({ description: "Agent name (default: worker)" })),
    timeoutMs: Type.Optional(Type.Number({ description: "Timeout in milliseconds" })),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const execJJ = async (args: string[], opts?: { cwd?: string }) => {
      const r = await pi.exec("jj", args, opts?.cwd ? { cwd: opts.cwd } : undefined);
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    };

    const { agents } = discoverAgents(ctx.cwd, "both");
    const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

    const r = await handleOneshotTool(ctx.cwd, params, dispatcher, execJJ);
    if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: undefined };
  },
});
```

3) Add a new `pipeline` tool registration block (place it near the other tool registrations):

```ts
pi.registerTool({
  name: "pipeline",
  label: "Pipeline",
  description: "Run the implement → verify → review pipeline for the specified plan task in an isolated jj workspace.",
  parameters: Type.Object({
    taskIndex: Type.Number(),
    resume: Type.Optional(Type.Boolean()),
    guidance: Type.Optional(Type.String()),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const execJJ = async (args: string[], opts?: { cwd?: string }) => {
      const r = await pi.exec("jj", args, opts?.cwd ? { cwd: opts.cwd } : undefined);
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    };

    const { agents } = discoverAgents(ctx.cwd, "both");
    const dispatcher = new PiSubagentsDispatcher({ runSync, runtimeCwd: ctx.cwd, agents });

    const r = await handlePipelineTool(
      ctx.cwd,
      { taskIndex: params.taskIndex, resume: params.resume, guidance: params.guidance },
      dispatcher,
      execJJ,
    );

    if (r.error) return { content: [{ type: "text", text: `Error: ${r.error}` }], details: undefined };

    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], details: undefined };
  },
});
```

4) Delete the entire `subagent_status` tool registration block:

```ts
pi.registerTool({
  name: "subagent_status",
  ...
});
```

(There should be no remaining references to `handleSubagentStatus`.)


**Step 4 — Run test, verify it passes**
Run: `bun test tests/tools-wiring.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing

---

## Task 19: Clean slate replacement — delete old subagent implementation/tests

**Covers AC 34.**

**Files:**
- Delete:
  - `extensions/megapowers/subagent/subagent-agents.ts`
  - `extensions/megapowers/subagent/subagent-async.ts`
  - `extensions/megapowers/subagent/subagent-context.ts`
  - `extensions/megapowers/subagent/subagent-errors.ts`
  - `extensions/megapowers/subagent/subagent-runner.ts`
  - `extensions/megapowers/subagent/subagent-status.ts`
  - `extensions/megapowers/subagent/subagent-tools.ts`
  - `extensions/megapowers/subagent/subagent-validate.ts`
  - `extensions/megapowers/subagent/subagent-workspace.ts`
- Delete:
  - `tests/subagent-agents.test.ts`
  - `tests/subagent-async.test.ts`
  - `tests/subagent-context.test.ts`
  - `tests/subagent-errors.test.ts`
  - `tests/subagent-runner.test.ts`
  - `tests/subagent-status.test.ts`
  - `tests/subagent-tools.test.ts`
  - `tests/subagent-validate.test.ts`
  - `tests/subagent-workspace.test.ts`
- Test: `tests/clean-slate.test.ts`

**Step 1 — Write the failing test**
Create `tests/clean-slate.test.ts`:

```ts
import { describe, it, expect } from "bun:test";

describe("clean slate subagent replacement", () => {
  it("old subagent modules are not importable", async () => {
    const oldMods = [
      "../extensions/megapowers/subagent/subagent-async.js",
      "../extensions/megapowers/subagent/subagent-runner.js",
      "../extensions/megapowers/subagent/subagent-status.js",
      "../extensions/megapowers/subagent/subagent-tools.js",
      "../extensions/megapowers/subagent/subagent-validate.js",
    ];

    for (const m of oldMods) {
      let threw = false;
      try {
        await import(m);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/clean-slate.test.ts`

Expected: FAIL — at least one old module is still importable.

**Step 3 — Write minimal implementation**
Delete all files listed above.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/clean-slate.test.ts`

Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`

Expected: all passing
