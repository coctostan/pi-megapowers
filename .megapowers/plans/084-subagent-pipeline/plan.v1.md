# Plan: Subagent Pipeline (#084)

## AC → Task Mapping

| AC | Task(s) | Description |
|----|---------|-------------|
| 1 | 1 | Dispatcher interface + DispatchResult type |
| 2 | 2 | PiSubagentsDispatcher wrapping runSync |
| 3 | 3 | pi-subagents npm dependency |
| 10 | 4 | Step context builder — initial context |
| 11,12 | 5 | Step context builder — accumulation + retry context |
| 13 | 6 | TDD auditor — core compliance check |
| 14,15 | 7 | TDD auditor — file classification + config exclusion |
| 17 | 8 | Result parser — parseStepResult |
| 18 | 9 | Result parser — parseReviewVerdict |
| 23,24 | 10 | Pipeline log — write + read JSONL |
| 19 | 11 | jj workspace manager — createPipelineWorkspace |
| 20 | 12 | jj workspace manager — squashPipelineWorkspace |
| 21,22 | 13 | jj workspace manager — cleanupPipelineWorkspace + execJJ dependency |
| 4,8 | 14 | Pipeline runner — happy path (implement → verify → review) |
| 5 | 15 | Pipeline runner — verify failure retry |
| 6 | 16 | Pipeline runner — review rejection retry |
| 7 | 17 | Pipeline runner — retry budget exhaustion → paused |
| 9 | 18 | Pipeline runner — step timeout |
| 16 | 19 | Pipeline runner — TDD report in review context |
| 31 | 20 | Agent definitions — implementer agent |
| 32 | 21 | Agent definitions — reviewer agent |
| 33 | 22 | Agent definitions — verifier agent |
| 25,26 | 23 | Pipeline tool — basic dispatch |
| 27 | 24 | Pipeline tool — pause + resume |
| 28 | 25 | Pipeline tool — completed → squash + task_done |
| 29,30 | 26 | One-shot subagent tool |
| 34 | 27 | Clean slate — remove old subagent files |

---

### Task 1: Dispatcher interface and DispatchResult types [no-test]

**Justification:** Pure type definitions and interface — no runtime behavior to test. The next task tests the concrete implementation.

**Covers AC 1.**

**Files:**
- Create: `extensions/megapowers/subagent/dispatcher.ts`

**Step 1 — Make the change**

Create `extensions/megapowers/subagent/dispatcher.ts`:

```ts
// extensions/megapowers/subagent/dispatcher.ts

import type { Message } from "@mariozechner/pi-ai";

export interface DispatchConfig {
  agent: string;
  task: string;
  cwd: string;
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
Expected: no type errors

---

### Task 2: PiSubagentsDispatcher implementation [depends: 1]

**Covers AC 2.**

**Files:**
- Create: `extensions/megapowers/subagent/pi-subagents-dispatcher.ts`
- Test: `tests/pi-subagents-dispatcher.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pi-subagents-dispatcher.test.ts
import { describe, it, expect } from "bun:test";
import {
  PiSubagentsDispatcher,
  extractFilesChanged,
  extractTestsPassed,
} from "../extensions/megapowers/subagent/pi-subagents-dispatcher.js";
import type { DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

describe("extractFilesChanged", () => {
  it("extracts file paths from write and edit tool calls in messages", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/foo.ts", content: "x" } }],
      },
      {
        role: "tool" as const,
        content: [{ type: "tool_result" as const, tool_use_id: "1", content: "ok" }],
      },
      {
        role: "assistant" as const,
        content: [{ type: "tool_use" as const, id: "2", name: "edit", input: { path: "src/bar.ts" } }],
      },
    ];
    const files = extractFilesChanged(messages as any);
    expect(files).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("returns empty array when no write/edit calls", () => {
    const messages = [
      { role: "assistant" as const, content: [{ type: "text" as const, text: "hello" }] },
    ];
    expect(extractFilesChanged(messages as any)).toEqual([]);
  });

  it("deduplicates file paths", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [
          { type: "tool_use" as const, id: "1", name: "write", input: { path: "src/foo.ts", content: "a" } },
          { type: "tool_use" as const, id: "2", name: "edit", input: { path: "src/foo.ts" } },
        ],
      },
    ];
    expect(extractFilesChanged(messages as any)).toEqual(["src/foo.ts"]);
  });
});

describe("extractTestsPassed", () => {
  it("detects passing tests from bash tool output", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "tool_use" as const, id: "1", name: "bash", input: { command: "bun test" } }],
      },
      {
        role: "tool" as const,
        content: [{ type: "tool_result" as const, tool_use_id: "1", content: "5 pass\n0 fail" }],
      },
    ];
    expect(extractTestsPassed(messages as any)).toBe(true);
  });

  it("detects failing tests", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "tool_use" as const, id: "1", name: "bash", input: { command: "bun test" } }],
      },
      {
        role: "tool" as const,
        content: [{ type: "tool_result" as const, tool_use_id: "1", content: "3 pass\n2 fail" }],
      },
    ];
    expect(extractTestsPassed(messages as any)).toBe(false);
  });

  it("returns null when no test commands found", () => {
    const messages = [
      { role: "assistant" as const, content: [{ type: "text" as const, text: "done" }] },
    ];
    expect(extractTestsPassed(messages as any)).toBe(null);
  });
});

describe("PiSubagentsDispatcher", () => {
  it("translates DispatchConfig to runSync args and returns DispatchResult", async () => {
    let capturedArgs: any = null;
    const mockRunSync = async (...args: any[]) => {
      capturedArgs = args;
      return {
        agent: "implementer",
        task: "do thing",
        exitCode: 0,
        messages: [
          {
            role: "assistant" as const,
            content: [{ type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts", content: "code" } }],
          },
          {
            role: "tool" as const,
            content: [{ type: "tool_result" as const, tool_use_id: "1", content: "ok" }],
          },
          {
            role: "assistant" as const,
            content: [{ type: "tool_use" as const, id: "2", name: "bash", input: { command: "bun test" } }],
          },
          {
            role: "tool" as const,
            content: [{ type: "tool_result" as const, tool_use_id: "2", content: "1 pass\n0 fail" }],
          },
        ],
        usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.01, turns: 2 },
      };
    };

    const dispatcher = new PiSubagentsDispatcher(mockRunSync as any, [], "/project");

    const config: DispatchConfig = {
      agent: "implementer",
      task: "implement the feature",
      cwd: "/project/workspace",
      model: "anthropic/claude-sonnet-4",
      timeoutMs: 300000,
    };

    const result = await dispatcher.dispatch(config);
    expect(result.exitCode).toBe(0);
    expect(result.filesChanged).toEqual(["src/a.ts"]);
    expect(result.testsPassed).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify runSync was called with correct agent name and task
    expect(capturedArgs[2]).toBe("implementer");
    expect(capturedArgs[3]).toBe("implement the feature");
  });

  it("returns error when runSync returns non-zero exit code", async () => {
    const mockRunSync = async () => ({
      agent: "implementer",
      task: "do thing",
      exitCode: 1,
      messages: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      error: "Process crashed",
    });

    const dispatcher = new PiSubagentsDispatcher(mockRunSync as any, [], "/project");
    const result = await dispatcher.dispatch({
      agent: "implementer",
      task: "fail",
      cwd: "/project",
    });
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe("Process crashed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pi-subagents-dispatcher.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pi-subagents-dispatcher.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pi-subagents-dispatcher.ts
import type { Message } from "@mariozechner/pi-ai";
import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import type { AgentConfig } from "pi-subagents/agents.js";
import type { RunSyncOptions, SingleResult } from "pi-subagents/types.js";

type RunSyncFn = (
  runtimeCwd: string,
  agents: AgentConfig[],
  agentName: string,
  task: string,
  options: RunSyncOptions,
) => Promise<SingleResult>;

const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/,
  /\bnpx?\s+(jest|vitest|mocha)\b/,
  /\bpnpm\s+test\b/,
  /\byarn\s+test\b/,
  /\bnpm\s+test\b/,
];

const TEST_PASS_PATTERN = /(\d+)\s+pass/i;
const TEST_FAIL_PATTERN = /(\d+)\s+fail/i;

export function extractFilesChanged(messages: Message[]): string[] {
  const files = new Set<string>();
  for (const msg of messages) {
    if (!("content" in msg) || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (
        block.type === "tool_use" &&
        (block.name === "write" || block.name === "edit") &&
        block.input &&
        typeof (block.input as any).path === "string"
      ) {
        files.add((block.input as any).path);
      }
    }
  }
  return [...files];
}

export function extractTestsPassed(messages: Message[]): boolean | null {
  let lastTestResult: boolean | null = null;

  // Build a map of tool_use_id -> tool_use for bash commands
  const bashCalls = new Map<string, string>();
  for (const msg of messages) {
    if (!("content" in msg) || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (
        block.type === "tool_use" &&
        block.name === "bash" &&
        block.input &&
        typeof (block.input as any).command === "string"
      ) {
        const cmd = (block.input as any).command;
        if (TEST_COMMAND_PATTERNS.some(p => p.test(cmd))) {
          bashCalls.set(block.id, cmd);
        }
      }
    }
  }

  if (bashCalls.size === 0) return null;

  // Find tool results for those bash calls
  for (const msg of messages) {
    if (!("content" in msg) || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === "tool_result" && bashCalls.has(block.tool_use_id)) {
        const text = typeof block.content === "string" ? block.content : "";
        const failMatch = text.match(TEST_FAIL_PATTERN);
        const passMatch = text.match(TEST_PASS_PATTERN);
        if (passMatch || failMatch) {
          const failCount = failMatch ? parseInt(failMatch[1], 10) : 0;
          lastTestResult = failCount === 0;
        }
      }
    }
  }

  return lastTestResult;
}

let runIdCounter = 0;

export class PiSubagentsDispatcher implements Dispatcher {
  constructor(
    private runSync: RunSyncFn,
    private agents: AgentConfig[],
    private runtimeCwd: string,
  ) {}

  async dispatch(config: DispatchConfig): Promise<DispatchResult> {
    const runId = `pipeline-${++runIdCounter}-${Date.now()}`;
    const controller = new AbortController();

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (config.timeoutMs) {
      timer = setTimeout(() => controller.abort(), config.timeoutMs);
    }

    try {
      const taskPrompt = config.context
        ? `${config.task}\n\n## Context\n\n${config.context}`
        : config.task;

      const result = await this.runSync(
        this.runtimeCwd,
        this.agents,
        config.agent,
        taskPrompt,
        {
          runId,
          cwd: config.cwd,
          signal: controller.signal,
          modelOverride: config.model,
        },
      );

      return {
        exitCode: result.exitCode,
        messages: result.messages,
        filesChanged: extractFilesChanged(result.messages),
        testsPassed: extractTestsPassed(result.messages),
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
    } finally {
      if (timer) clearTimeout(timer);
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

### Task 3: Add pi-subagents npm dependency [no-test]

**Justification:** Package.json change only — verified by checking the dependency resolves.

**Covers AC 3.**

**Files:**
- Modify: `package.json`

**Step 1 — Make the change**

Add `pi-subagents` to `dependencies` in `package.json`:

```json
"dependencies": {
  "pi-subagents": "^0.11.0"
}
```

Then run `bun install`.

**Step 2 — Verify**
Run: `bun install && ls node_modules/pi-subagents/execution.ts`
Expected: file exists, install succeeds

---

### Task 4: Step context builder — initial context [depends: 1]

**Covers AC 10.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-context.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  type PipelineContext,
} from "../extensions/megapowers/subagent/pipeline-context.js";

describe("buildInitialContext", () => {
  it("produces context from task, plan, spec, and learnings", () => {
    const ctx = buildInitialContext({
      taskDescription: "Implement the parser",
      planSection: "### Task 2: Build parser\n\nCreate src/parser.ts",
      specContent: "## Acceptance Criteria\n\n1. Parser parses JSON",
      learnings: "Use bun test for running tests",
    });

    expect(ctx.taskDescription).toBe("Implement the parser");
    expect(ctx.planSection).toBe("### Task 2: Build parser\n\nCreate src/parser.ts");
    expect(ctx.specContent).toBe("## Acceptance Criteria\n\n1. Parser parses JSON");
    expect(ctx.learnings).toBe("Use bun test for running tests");
    expect(ctx.steps).toEqual([]);
    expect(ctx.retryReason).toBeUndefined();
  });

  it("works with minimal input (task only)", () => {
    const ctx = buildInitialContext({ taskDescription: "Do the thing" });
    expect(ctx.taskDescription).toBe("Do the thing");
    expect(ctx.planSection).toBeUndefined();
    expect(ctx.specContent).toBeUndefined();
    expect(ctx.learnings).toBeUndefined();
    expect(ctx.steps).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-context.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-context.ts

export interface StepOutput {
  step: string;
  filesChanged: string[];
  testOutput?: string;
  reviewFindings?: string;
  tddReport?: string;
  error?: string;
}

export interface PipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
  steps: StepOutput[];
  retryReason?: string;
  reviewFindings?: string;
}

export interface InitialContextInput {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}

export function buildInitialContext(input: InitialContextInput): PipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
    steps: [],
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 5: Step context builder — accumulation and retry context [depends: 4]

**Covers AC 11, 12.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-context.ts`
- Test: `tests/pipeline-context.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-context.test.ts`:

```ts
import {
  appendStepOutput,
  setRetryContext,
  renderContextPrompt,
} from "../extensions/megapowers/subagent/pipeline-context.js";

describe("appendStepOutput", () => {
  it("appends step output to context", () => {
    const ctx = buildInitialContext({ taskDescription: "task" });
    const updated = appendStepOutput(ctx, {
      step: "implement",
      filesChanged: ["src/a.ts"],
      testOutput: "1 pass",
    });
    expect(updated.steps).toHaveLength(1);
    expect(updated.steps[0].step).toBe("implement");
    expect(updated.steps[0].filesChanged).toEqual(["src/a.ts"]);
  });

  it("accumulates multiple step outputs", () => {
    let ctx = buildInitialContext({ taskDescription: "task" });
    ctx = appendStepOutput(ctx, { step: "implement", filesChanged: ["a.ts"] });
    ctx = appendStepOutput(ctx, { step: "verify", filesChanged: [], testOutput: "all pass" });
    expect(ctx.steps).toHaveLength(2);
    expect(ctx.steps[1].step).toBe("verify");
  });
});

describe("setRetryContext", () => {
  it("sets retry reason and review findings on context", () => {
    const ctx = buildInitialContext({ taskDescription: "task" });
    const updated = setRetryContext(ctx, "Tests failed: 2 errors", "Fix the null check");
    expect(updated.retryReason).toBe("Tests failed: 2 errors");
    expect(updated.reviewFindings).toBe("Fix the null check");
  });
});

describe("renderContextPrompt", () => {
  it("renders full context as markdown prompt", () => {
    let ctx = buildInitialContext({
      taskDescription: "Build parser",
      planSection: "### Task 2: Parser",
      specContent: "AC1: Parse JSON",
      learnings: "Use bun test",
    });
    ctx = appendStepOutput(ctx, {
      step: "implement",
      filesChanged: ["src/parser.ts"],
    });
    ctx = setRetryContext(ctx, "Tests failed");

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Build parser");
    expect(prompt).toContain("### Task 2: Parser");
    expect(prompt).toContain("AC1: Parse JSON");
    expect(prompt).toContain("Use bun test");
    expect(prompt).toContain("src/parser.ts");
    expect(prompt).toContain("Tests failed");
  });

  it("omits empty sections", () => {
    const ctx = buildInitialContext({ taskDescription: "Simple task" });
    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Simple task");
    expect(prompt).not.toContain("Plan");
    expect(prompt).not.toContain("Retry");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context.test.ts`
Expected: FAIL — `appendStepOutput` is not a function / not exported

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-context.ts`:

```ts
export function appendStepOutput(ctx: PipelineContext, output: StepOutput): PipelineContext {
  return { ...ctx, steps: [...ctx.steps, output] };
}

export function setRetryContext(
  ctx: PipelineContext,
  retryReason: string,
  reviewFindings?: string,
): PipelineContext {
  return { ...ctx, retryReason, reviewFindings: reviewFindings ?? ctx.reviewFindings };
}

export function renderContextPrompt(ctx: PipelineContext): string {
  const sections: string[] = [];

  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.steps.length > 0) {
    const stepLines = ctx.steps.map(s => {
      const parts = [`### ${s.step}`];
      if (s.filesChanged.length > 0) parts.push(`Files: ${s.filesChanged.join(", ")}`);
      if (s.testOutput) parts.push(`Test output: ${s.testOutput}`);
      if (s.reviewFindings) parts.push(`Review findings: ${s.reviewFindings}`);
      if (s.tddReport) parts.push(`TDD report: ${s.tddReport}`);
      if (s.error) parts.push(`Error: ${s.error}`);
      return parts.join("\n");
    });
    sections.push(`## Previous Steps\n\n${stepLines.join("\n\n")}`);
  }

  if (ctx.retryReason) sections.push(`## Retry Reason\n\n${ctx.retryReason}`);
  if (ctx.reviewFindings) sections.push(`## Review Findings\n\n${ctx.reviewFindings}`);

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

### Task 6: TDD auditor — core compliance check [depends: 1]

**Covers AC 13.**

**Files:**
- Create: `extensions/megapowers/subagent/tdd-auditor.ts`
- Test: `tests/tdd-auditor.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/tdd-auditor.test.ts
import { describe, it, expect } from "bun:test";
import {
  auditTddCompliance,
  type ToolCallRecord,
  type TddComplianceReport,
} from "../extensions/megapowers/subagent/tdd-auditor.js";

describe("auditTddCompliance", () => {
  it("returns compliant report for correct TDD order: test → run(fail) → prod → run(pass)", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "tests/foo.test.ts", content: "test code" } },
      { tool: "bash", args: { command: "bun test tests/foo.test.ts" }, output: "1 fail" },
      { tool: "write", args: { path: "src/foo.ts", content: "impl" } },
      { tool: "bash", args: { command: "bun test tests/foo.test.ts" }, output: "1 pass\n0 fail" },
    ];

    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(true);
    expect(report.testRanBeforeProduction).toBe(true);
    expect(report.productionFilesBeforeTest).toEqual([]);
    expect(report.testRunCount).toBe(2);
  });

  it("detects production file written before any test file", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "src/foo.ts", content: "impl" } },
      { tool: "write", args: { path: "tests/foo.test.ts", content: "test" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 pass" },
    ];

    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(false);
    expect(report.productionFilesBeforeTest).toEqual(["src/foo.ts"]);
  });

  it("detects test not run before production code", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "tests/foo.test.ts", content: "test" } },
      { tool: "write", args: { path: "src/foo.ts", content: "impl" } },
    ];

    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(true);
    expect(report.testRanBeforeProduction).toBe(false);
    expect(report.testRunCount).toBe(0);
  });

  it("returns empty/clean report for no tool calls", () => {
    const report = auditTddCompliance([]);
    expect(report.testWrittenFirst).toBe(true);
    expect(report.testRanBeforeProduction).toBe(true);
    expect(report.productionFilesBeforeTest).toEqual([]);
    expect(report.testRunCount).toBe(0);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/tdd-auditor.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/tdd-auditor.ts

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

const TEST_FILE_PATTERNS = [/\.test\.\w+$/, /\.spec\.\w+$/, /(^|\/)tests\//];
const CONFIG_FILE_PATTERNS = [
  /package\.json$/, /tsconfig.*\.json$/, /\.gitignore$/,
  /\.eslintrc/, /\.prettierrc/, /bun\.lockb$/, /\.env/,
  /\.ya?ml$/, /\.toml$/, /\.md$/,
];
const WRITE_TOOLS = new Set(["write", "edit"]);
const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/, /\bnpx?\s+(jest|vitest|mocha)\b/,
  /\bpnpm\s+test\b/, /\byarn\s+test\b/, /\bnpm\s+test\b/,
];

function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERNS.some(p => p.test(path));
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_PATTERNS.some(p => p.test(path));
}

function isTestCommand(command: string): boolean {
  return TEST_COMMAND_PATTERNS.some(p => p.test(command));
}

export function auditTddCompliance(toolCalls: ToolCallRecord[]): TddComplianceReport {
  let firstTestFileWritten = false;
  let firstTestRunSeen = false;
  let firstProductionFileWritten = false;
  const productionFilesBeforeTest: string[] = [];
  let testRunCount = 0;

  for (const call of toolCalls) {
    if (WRITE_TOOLS.has(call.tool)) {
      const filePath = call.args?.path;
      if (!filePath || typeof filePath !== "string") continue;
      if (isConfigFile(filePath)) continue;

      if (isTestFile(filePath)) {
        firstTestFileWritten = true;
      } else {
        if (!firstTestFileWritten) {
          productionFilesBeforeTest.push(filePath);
        }
        if (!firstProductionFileWritten) {
          firstProductionFileWritten = true;
        }
      }
    }

    if (call.tool === "bash") {
      const command = call.args?.command;
      if (typeof command === "string" && isTestCommand(command)) {
        testRunCount++;
        if (!firstTestRunSeen) {
          firstTestRunSeen = true;
        }
      }
    }
  }

  const testWrittenFirst = productionFilesBeforeTest.length === 0;
  const testRanBeforeProduction = !firstProductionFileWritten || firstTestRunSeen || !firstTestFileWritten;

  // Refine: testRanBeforeProduction should check that a test run happened
  // before the first production file write
  let testRunBeforeProd = true;
  if (firstProductionFileWritten && firstTestFileWritten) {
    let sawTestRun = false;
    for (const call of toolCalls) {
      if (call.tool === "bash" && typeof call.args?.command === "string" && isTestCommand(call.args.command)) {
        sawTestRun = true;
      }
      if (WRITE_TOOLS.has(call.tool)) {
        const filePath = call.args?.path;
        if (filePath && typeof filePath === "string" && !isConfigFile(filePath) && !isTestFile(filePath)) {
          testRanBeforeProduction && (testRunBeforeProd = sawTestRun);
          break;
        }
      }
    }
    return {
      testWrittenFirst,
      testRanBeforeProduction: testRunBeforeProd,
      productionFilesBeforeTest,
      testRunCount,
    };
  }

  return {
    testWrittenFirst,
    testRanBeforeProduction: testRunBeforeProd,
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

### Task 7: TDD auditor — file classification and config exclusion [depends: 6]

**Covers AC 14, 15.**

**Files:**
- Modify: `tests/tdd-auditor.test.ts` (append tests)

**Step 1 — Write the failing test**

Append to `tests/tdd-auditor.test.ts`:

```ts
describe("file classification", () => {
  it("identifies *.spec.ts as test file", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "src/foo.spec.ts", content: "test" } },
      { tool: "bash", args: { command: "bun test" }, output: "0 fail" },
      { tool: "write", args: { path: "src/foo.ts", content: "impl" } },
    ];
    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(true);
  });

  it("identifies tests/ directory files as test files", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "tests/parser.ts", content: "test" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
      { tool: "write", args: { path: "src/parser.ts", content: "impl" } },
    ];
    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(true);
  });

  it("excludes config files from TDD ordering checks", () => {
    const calls: ToolCallRecord[] = [
      { tool: "write", args: { path: "package.json", content: "{}" } },
      { tool: "write", args: { path: "tsconfig.json", content: "{}" } },
      { tool: "write", args: { path: ".gitignore", content: "node_modules" } },
      { tool: "write", args: { path: "tests/foo.test.ts", content: "test" } },
      { tool: "bash", args: { command: "bun test" }, output: "1 fail" },
      { tool: "write", args: { path: "src/foo.ts", content: "impl" } },
    ];
    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(true);
    expect(report.productionFilesBeforeTest).toEqual([]);
  });

  it("identifies .js and .ts production files", () => {
    const calls: ToolCallRecord[] = [
      { tool: "edit", args: { path: "src/util.js" } },
      { tool: "write", args: { path: "tests/util.test.ts", content: "test" } },
    ];
    const report = auditTddCompliance(calls);
    expect(report.testWrittenFirst).toBe(false);
    expect(report.productionFilesBeforeTest).toEqual(["src/util.js"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tdd-auditor.test.ts`
Expected: PASS — these should pass with the existing implementation from Task 6. If any fail, it reveals a gap to fix.

Note: If all pass immediately, this is expected — the implementation in Task 6 already handles these cases. This task serves as verification coverage.

**Step 3 — Write minimal implementation**
No additional implementation needed if tests pass.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tdd-auditor.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 8: Result parser — parseStepResult [depends: 1]

**Covers AC 17.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-results.test.ts
import { describe, it, expect } from "bun:test";
import {
  parseStepResult,
  type StepResult,
} from "../extensions/megapowers/subagent/pipeline-results.js";
import type { DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";

describe("parseStepResult", () => {
  it("extracts files changed from write/edit tool calls", () => {
    const dispatch: DispatchResult = {
      exitCode: 0,
      messages: [
        {
          role: "assistant" as const,
          content: [
            { type: "tool_use" as const, id: "1", name: "write", input: { path: "src/a.ts", content: "x" } },
            { type: "tool_use" as const, id: "2", name: "edit", input: { path: "src/b.ts" } },
          ],
        },
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Done implementing." }],
        },
      ] as any,
      filesChanged: ["src/a.ts", "src/b.ts"],
      testsPassed: true,
    };

    const result = parseStepResult(dispatch);
    expect(result.filesChanged).toEqual(["src/a.ts", "src/b.ts"]);
    expect(result.testsPassed).toBe(true);
    expect(result.finalOutput).toContain("Done implementing");
  });

  it("extracts test pass/fail from dispatch result", () => {
    const dispatch: DispatchResult = {
      exitCode: 0,
      messages: [],
      filesChanged: [],
      testsPassed: false,
    };
    const result = parseStepResult(dispatch);
    expect(result.testsPassed).toBe(false);
  });

  it("captures error when exit code is non-zero", () => {
    const dispatch: DispatchResult = {
      exitCode: 1,
      messages: [],
      filesChanged: [],
      testsPassed: null,
      error: "Segfault",
    };
    const result = parseStepResult(dispatch);
    expect(result.error).toBe("Segfault");
  });

  it("extracts final text output from last assistant message", () => {
    const dispatch: DispatchResult = {
      exitCode: 0,
      messages: [
        { role: "assistant" as const, content: [{ type: "text" as const, text: "First message" }] },
        { role: "assistant" as const, content: [{ type: "text" as const, text: "Final summary" }] },
      ] as any,
      filesChanged: [],
      testsPassed: null,
    };
    const result = parseStepResult(dispatch);
    expect(result.finalOutput).toContain("Final summary");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-results.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-results.ts

import type { DispatchResult } from "./dispatcher.js";
import type { Message } from "@mariozechner/pi-ai";

export interface StepResult {
  filesChanged: string[];
  testsPassed: boolean | null;
  finalOutput: string;
  error?: string;
}

function extractFinalOutput(messages: Message[]): string {
  const textParts: string[] = [];
  for (const msg of messages) {
    if (!("role" in msg) || (msg as any).role !== "assistant") continue;
    if (!("content" in msg) || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === "text" && "text" in block) {
        textParts.push((block as any).text);
      }
    }
  }
  return textParts.join("\n");
}

export function parseStepResult(dispatch: DispatchResult): StepResult {
  return {
    filesChanged: dispatch.filesChanged,
    testsPassed: dispatch.testsPassed,
    finalOutput: extractFinalOutput(dispatch.messages),
    error: dispatch.error,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-results.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 9: Result parser — parseReviewVerdict [depends: 8]

**Covers AC 18.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-results.ts`
- Test: `tests/pipeline-results.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-results.test.ts`:

```ts
import { parseReviewVerdict } from "../extensions/megapowers/subagent/pipeline-results.js";

describe("parseReviewVerdict", () => {
  it("extracts approve verdict", () => {
    const text = `## Review Summary\n\nAll changes look good.\n\n**Verdict: approve**\n\nNo blocking issues found.`;
    const verdict = parseReviewVerdict(text);
    expect(verdict.verdict).toBe("approve");
  });

  it("extracts reject verdict", () => {
    const text = `## Review\n\nFound issues.\n\n**Verdict: reject**\n\n## Findings\n\n- Missing error handling in parser.ts:42\n- No input validation`;
    const verdict = parseReviewVerdict(text);
    expect(verdict.verdict).toBe("reject");
    expect(verdict.findings.length).toBeGreaterThan(0);
  });

  it("extracts findings from bullet list", () => {
    const text = `Verdict: reject\n\n## Findings\n\n- Bug: null check missing\n- Style: inconsistent naming\n- Missing test for edge case`;
    const verdict = parseReviewVerdict(text);
    expect(verdict.findings).toEqual([
      "Bug: null check missing",
      "Style: inconsistent naming",
      "Missing test for edge case",
    ]);
  });

  it("defaults to reject when no verdict keyword found", () => {
    const text = `The code has issues that need to be addressed.`;
    const verdict = parseReviewVerdict(text);
    expect(verdict.verdict).toBe("reject");
  });

  it("extracts approve with various formats", () => {
    expect(parseReviewVerdict("verdict: approve").verdict).toBe("approve");
    expect(parseReviewVerdict("VERDICT: APPROVE").verdict).toBe("approve");
    expect(parseReviewVerdict("**Verdict:** approve").verdict).toBe("approve");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-results.test.ts`
Expected: FAIL — `parseReviewVerdict` is not exported / not a function

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-results.ts`:

```ts
export interface ReviewVerdict {
  verdict: "approve" | "reject";
  findings: string[];
}

const APPROVE_PATTERN = /verdict[:\s*]*\**\s*approve/i;

export function parseReviewVerdict(text: string): ReviewVerdict {
  const verdict: "approve" | "reject" = APPROVE_PATTERN.test(text) ? "approve" : "reject";

  const findings: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)/);
    if (match) findings.push(match[1].trim());
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

### Task 10: Pipeline log — write and read JSONL [depends: 1]

**Covers AC 23, 24.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-log.ts`
- Test: `tests/pipeline-log.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-log.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeLogEntry,
  readPipelineLog,
  type PipelineLogEntry,
} from "../extensions/megapowers/subagent/pipeline-log.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("pipeline log", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "pipeline-log-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes a JSONL entry to the log file", () => {
    writeLogEntry(tmp, "pipe-1", {
      step: "implement",
      status: "completed",
      durationMs: 5000,
      summary: "Wrote src/foo.ts",
    });

    const logPath = join(tmp, ".megapowers", "subagents", "pipe-1", "log.jsonl");
    expect(existsSync(logPath)).toBe(true);

    const content = readFileSync(logPath, "utf-8").trim();
    const entry = JSON.parse(content);
    expect(entry.step).toBe("implement");
    expect(entry.status).toBe("completed");
    expect(entry.durationMs).toBe(5000);
  });

  it("appends multiple entries", () => {
    writeLogEntry(tmp, "pipe-1", { step: "implement", status: "completed", durationMs: 3000, summary: "done" });
    writeLogEntry(tmp, "pipe-1", { step: "verify", status: "completed", durationMs: 2000, summary: "pass" });
    writeLogEntry(tmp, "pipe-1", { step: "review", status: "completed", durationMs: 4000, summary: "approved" });

    const entries = readPipelineLog(tmp, "pipe-1");
    expect(entries).toHaveLength(3);
    expect(entries[0].step).toBe("implement");
    expect(entries[1].step).toBe("verify");
    expect(entries[2].step).toBe("review");
  });

  it("includes error field when present", () => {
    writeLogEntry(tmp, "pipe-1", {
      step: "verify",
      status: "failed",
      durationMs: 1000,
      summary: "Tests failed",
      error: "2 tests failed",
    });

    const entries = readPipelineLog(tmp, "pipe-1");
    expect(entries[0].error).toBe("2 tests failed");
  });

  it("returns empty array when log file does not exist", () => {
    const entries = readPipelineLog(tmp, "nonexistent");
    expect(entries).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-log.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-log.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-log.ts

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface PipelineLogEntry {
  step: string;
  status: string;
  durationMs: number;
  summary: string;
  error?: string;
}

function logDir(cwd: string, pipelineId: string): string {
  return join(cwd, ".megapowers", "subagents", pipelineId);
}

function logPath(cwd: string, pipelineId: string): string {
  return join(logDir(cwd, pipelineId), "log.jsonl");
}

export function writeLogEntry(cwd: string, pipelineId: string, entry: PipelineLogEntry): void {
  const dir = logDir(cwd, pipelineId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(logPath(cwd, pipelineId), JSON.stringify(entry) + "\n");
}

export function readPipelineLog(cwd: string, pipelineId: string): PipelineLogEntry[] {
  const path = logPath(cwd, pipelineId);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map(line => JSON.parse(line));
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-log.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 11: jj workspace manager — createPipelineWorkspace [depends: 1]

**Covers AC 19.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-workspace.test.ts
import { describe, it, expect } from "bun:test";
import {
  createPipelineWorkspace,
  type ExecJJ,
} from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("createPipelineWorkspace", () => {
  it("calls jj workspace add with correct name and path", async () => {
    const calls: string[][] = [];
    const mockExecJJ: ExecJJ = async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    };

    const result = await createPipelineWorkspace("/project", "pipe-1", mockExecJJ);
    expect(result.workspaceName).toBe("mega-pipe-1");
    expect(result.workspacePath).toBe("/project/.megapowers/subagents/pipe-1/workspace");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      "workspace", "add", "--name", "mega-pipe-1",
      "/project/.megapowers/subagents/pipe-1/workspace",
    ]);
  });

  it("returns error when jj workspace add fails", async () => {
    const mockExecJJ: ExecJJ = async () => ({
      code: 1, stdout: "", stderr: "workspace already exists",
    });

    const result = await createPipelineWorkspace("/project", "pipe-1", mockExecJJ);
    expect(result.error).toContain("workspace already exists");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-workspace.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-workspace.ts

import { join } from "node:path";

export interface ExecJJResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ExecJJ = (args: string[]) => Promise<ExecJJResult>;

export interface WorkspaceResult {
  workspaceName: string;
  workspacePath: string;
  error?: string;
}

export function pipelineWorkspacePath(cwd: string, pipelineId: string): string {
  return join(cwd, ".megapowers", "subagents", pipelineId, "workspace");
}

export function pipelineWorkspaceName(pipelineId: string): string {
  return `mega-${pipelineId}`;
}

export async function createPipelineWorkspace(
  cwd: string,
  pipelineId: string,
  execJJ: ExecJJ,
): Promise<WorkspaceResult> {
  const wsName = pipelineWorkspaceName(pipelineId);
  const wsPath = pipelineWorkspacePath(cwd, pipelineId);

  const result = await execJJ([
    "workspace", "add", "--name", wsName, wsPath,
  ]);

  if (result.code !== 0) {
    return { workspaceName: wsName, workspacePath: wsPath, error: result.stderr || `jj workspace add failed (code ${result.code})` };
  }

  return { workspaceName: wsName, workspacePath: wsPath };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 12: jj workspace manager — squashPipelineWorkspace [depends: 11]

**Covers AC 20.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-workspace.test.ts`:

```ts
import { squashPipelineWorkspace } from "../extensions/megapowers/subagent/pipeline-workspace.js";

describe("squashPipelineWorkspace", () => {
  it("squashes workspace changes into parent and forgets workspace", async () => {
    const calls: string[][] = [];
    const mockExecJJ: ExecJJ = async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    };

    const result = await squashPipelineWorkspace("/project", "pipe-1", mockExecJJ);
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(2);
    // First: squash from workspace into parent
    expect(calls[0]).toEqual(["squash", "--from", "mega-pipe-1@"]);
    // Second: forget workspace
    expect(calls[1]).toEqual(["workspace", "forget", "mega-pipe-1"]);
  });

  it("returns error when squash fails", async () => {
    const mockExecJJ: ExecJJ = async (args) => {
      if (args[0] === "squash") return { code: 1, stdout: "", stderr: "conflict" };
      return { code: 0, stdout: "", stderr: "" };
    };

    const result = await squashPipelineWorkspace("/project", "pipe-1", mockExecJJ);
    expect(result.error).toContain("conflict");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `squashPipelineWorkspace` is not exported

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-workspace.ts`:

```ts
export interface SquashResult {
  error?: string;
}

export async function squashPipelineWorkspace(
  cwd: string,
  pipelineId: string,
  execJJ: ExecJJ,
): Promise<SquashResult> {
  const wsName = pipelineWorkspaceName(pipelineId);

  const squashResult = await execJJ(["squash", "--from", `${wsName}@`]);
  if (squashResult.code !== 0) {
    return { error: squashResult.stderr || `squash failed (code ${squashResult.code})` };
  }

  const forgetResult = await execJJ(["workspace", "forget", wsName]);
  if (forgetResult.code !== 0) {
    return { error: forgetResult.stderr || `workspace forget failed (code ${forgetResult.code})` };
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

### Task 13: jj workspace manager — cleanupPipelineWorkspace + execJJ dependency [depends: 11]

**Covers AC 21, 22.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-workspace.ts`
- Test: `tests/pipeline-workspace.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-workspace.test.ts`:

```ts
import { cleanupPipelineWorkspace } from "../extensions/megapowers/subagent/pipeline-workspace.js";
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("cleanupPipelineWorkspace", () => {
  it("forgets workspace and removes directory without squashing", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "cleanup-test-"));
    const wsDir = join(tmp, ".megapowers", "subagents", "pipe-1", "workspace");
    mkdirSync(wsDir, { recursive: true });

    const calls: string[][] = [];
    const mockExecJJ: ExecJJ = async (args) => {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    };

    const result = await cleanupPipelineWorkspace(tmp, "pipe-1", mockExecJJ);
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["workspace", "forget", "mega-pipe-1"]);
    expect(existsSync(wsDir)).toBe(false);

    rmSync(tmp, { recursive: true, force: true });
  });

  it("still removes directory even if jj forget fails", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "cleanup-test-"));
    const wsDir = join(tmp, ".megapowers", "subagents", "pipe-1", "workspace");
    mkdirSync(wsDir, { recursive: true });

    const mockExecJJ: ExecJJ = async () => ({
      code: 1, stdout: "", stderr: "not found",
    });

    const result = await cleanupPipelineWorkspace(tmp, "pipe-1", mockExecJJ);
    // Error from jj forget is returned but directory is still cleaned up
    expect(existsSync(wsDir)).toBe(false);

    rmSync(tmp, { recursive: true, force: true });
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: FAIL — `cleanupPipelineWorkspace` is not exported

**Step 3 — Write minimal implementation**

Add to `extensions/megapowers/subagent/pipeline-workspace.ts`:

```ts
import { rmSync, existsSync } from "node:fs";

export async function cleanupPipelineWorkspace(
  cwd: string,
  pipelineId: string,
  execJJ: ExecJJ,
): Promise<SquashResult> {
  const wsName = pipelineWorkspaceName(pipelineId);
  const wsPath = pipelineWorkspacePath(cwd, pipelineId);

  let error: string | undefined;
  const forgetResult = await execJJ(["workspace", "forget", wsName]);
  if (forgetResult.code !== 0) {
    error = forgetResult.stderr || `workspace forget failed (code ${forgetResult.code})`;
  }

  // Always remove the workspace directory
  if (existsSync(wsPath)) {
    rmSync(wsPath, { recursive: true, force: true });
  }

  return error ? { error } : {};
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-workspace.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 14: Pipeline runner — happy path (implement → verify → review) [depends: 1, 4, 5, 8, 9, 10, 11]

**Covers AC 4, 8.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-runner.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-runner.test.ts
import { describe, it, expect } from "bun:test";
import {
  runPipeline,
  type PipelineOptions,
  type PipelineResult,
} from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";
import type { PipelineContext } from "../extensions/megapowers/subagent/pipeline-context.js";

function createMockDispatcher(responses: Record<string, DispatchResult>): Dispatcher {
  return {
    async dispatch(config: DispatchConfig): Promise<DispatchResult> {
      // Match on agent name
      return responses[config.agent] ?? {
        exitCode: 1, messages: [], filesChanged: [], testsPassed: null, error: "unknown agent",
      };
    },
  };
}

describe("runPipeline — happy path", () => {
  it("executes implement → verify → review and returns completed", async () => {
    const stepsCalled: string[] = [];
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        stepsCalled.push(config.agent);
        if (config.agent === "implementer") {
          return {
            exitCode: 0,
            messages: [],
            filesChanged: ["src/foo.ts"],
            testsPassed: null,
          };
        }
        if (config.agent === "verifier") {
          return {
            exitCode: 0,
            messages: [],
            filesChanged: [],
            testsPassed: true,
          };
        }
        if (config.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [
              { role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] },
            ] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null, error: "unknown" };
      },
    };

    const result = await runPipeline(
      {
        taskDescription: "Build the parser",
        planSection: "### Task 1: Parser",
      },
      dispatcher,
      {
        cwd: "/project",
        pipelineId: "pipe-test",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
      },
    );

    expect(result.status).toBe("completed");
    expect(result.filesChanged).toEqual(["src/foo.ts"]);
    expect(result.reviewVerdict).toBe("approve");
    expect(stepsCalled).toEqual(["implementer", "verifier", "reviewer"]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-runner.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-runner.ts

import type { Dispatcher, DispatchResult } from "./dispatcher.js";
import { buildInitialContext, appendStepOutput, setRetryContext, renderContextPrompt, type PipelineContext } from "./pipeline-context.js";
import { parseStepResult, parseReviewVerdict } from "./pipeline-results.js";
import { writeLogEntry } from "./pipeline-log.js";

export interface PipelineAgents {
  implementer: string;
  verifier: string;
  reviewer: string;
}

export interface PipelineOptions {
  cwd: string;
  pipelineId: string;
  agents: PipelineAgents;
  maxRetries?: number;
  stepTimeoutMs?: number;
  /** Skip writing log entries (for tests without temp dirs) */
  skipLog?: boolean;
}

export interface PipelineResult {
  status: "completed" | "paused";
  filesChanged: string[];
  testOutput?: string;
  reviewVerdict?: "approve" | "reject";
  reviewFindings?: string[];
  error?: string;
  log?: string;
  retryCount: number;
}

export interface PipelineTaskInput {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}

export async function runPipeline(
  taskInput: PipelineTaskInput,
  dispatcher: Dispatcher,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const maxRetries = options.maxRetries ?? 3;
  let context = buildInitialContext(taskInput);
  let retryCount = 0;
  let allFilesChanged: string[] = [];

  for (let cycle = 0; cycle <= maxRetries; cycle++) {
    // --- Implement ---
    const implStart = Date.now();
    const implResult = await dispatcher.dispatch({
      agent: options.agents.implementer,
      task: taskInput.taskDescription,
      cwd: options.cwd,
      context: cycle > 0 ? renderContextPrompt(context) : undefined,
    });
    const implParsed = parseStepResult(implResult);
    allFilesChanged = [...new Set([...allFilesChanged, ...implParsed.filesChanged])];

    context = appendStepOutput(context, {
      step: "implement",
      filesChanged: implParsed.filesChanged,
      error: implParsed.error,
    });

    if (!options.skipLog) {
      writeLogEntry(options.cwd, options.pipelineId, {
        step: "implement",
        status: implResult.exitCode === 0 ? "completed" : "failed",
        durationMs: Date.now() - implStart,
        summary: `Files: ${implParsed.filesChanged.join(", ")}`,
        error: implParsed.error,
      });
    }

    // --- Verify ---
    const verifyStart = Date.now();
    const verifyResult = await dispatcher.dispatch({
      agent: options.agents.verifier,
      task: "Run the test suite and report results",
      cwd: options.cwd,
      context: renderContextPrompt(context),
    });
    const verifyParsed = parseStepResult(verifyResult);

    context = appendStepOutput(context, {
      step: "verify",
      filesChanged: verifyParsed.filesChanged,
      testOutput: verifyParsed.finalOutput,
      error: verifyParsed.error,
    });

    if (!options.skipLog) {
      writeLogEntry(options.cwd, options.pipelineId, {
        step: "verify",
        status: verifyResult.testsPassed ? "completed" : "failed",
        durationMs: Date.now() - verifyStart,
        summary: verifyResult.testsPassed ? "Tests passed" : "Tests failed",
        error: verifyParsed.error,
      });
    }

    if (!verifyResult.testsPassed) {
      retryCount++;
      if (cycle >= maxRetries) {
        return {
          status: "paused",
          filesChanged: allFilesChanged,
          testOutput: verifyParsed.finalOutput,
          error: "Retry budget exhausted — tests still failing",
          retryCount,
        };
      }
      context = setRetryContext(context, `Verify failed: ${verifyParsed.error ?? verifyParsed.finalOutput}`);
      continue;
    }

    // --- Review ---
    const reviewStart = Date.now();
    const reviewResult = await dispatcher.dispatch({
      agent: options.agents.reviewer,
      task: "Review the implementation",
      cwd: options.cwd,
      context: renderContextPrompt(context),
    });
    const reviewParsed = parseStepResult(reviewResult);
    const verdict = parseReviewVerdict(reviewParsed.finalOutput);

    context = appendStepOutput(context, {
      step: "review",
      filesChanged: [],
      reviewFindings: verdict.findings.join("\n"),
    });

    if (!options.skipLog) {
      writeLogEntry(options.cwd, options.pipelineId, {
        step: "review",
        status: verdict.verdict === "approve" ? "completed" : "rejected",
        durationMs: Date.now() - reviewStart,
        summary: `Verdict: ${verdict.verdict}`,
      });
    }

    if (verdict.verdict === "approve") {
      return {
        status: "completed",
        filesChanged: allFilesChanged,
        testOutput: verifyParsed.finalOutput,
        reviewVerdict: "approve",
        reviewFindings: verdict.findings,
        retryCount,
      };
    }

    // Review rejected — retry full cycle
    retryCount++;
    if (cycle >= maxRetries) {
      return {
        status: "paused",
        filesChanged: allFilesChanged,
        reviewVerdict: "reject",
        reviewFindings: verdict.findings,
        error: "Retry budget exhausted — review still rejecting",
        retryCount,
      };
    }
    context = setRetryContext(context, `Review rejected: ${verdict.findings.join("; ")}`, verdict.findings.join("\n"));
  }

  // Should not reach here, but handle gracefully
  return {
    status: "paused",
    filesChanged: allFilesChanged,
    error: "Unexpected pipeline exit",
    retryCount,
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

### Task 15: Pipeline runner — verify failure retry [depends: 14]

**Covers AC 5.**

**Files:**
- Modify: `tests/pipeline-runner.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-runner.test.ts`:

```ts
describe("runPipeline — verify failure retry", () => {
  it("re-runs implement → verify when verify fails, passing failure context", async () => {
    let implCallCount = 0;
    let lastImplContext: string | undefined;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          implCallCount++;
          lastImplContext = config.context;
          return { exitCode: 0, messages: [], filesChanged: ["src/foo.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          // First verify fails, second passes
          if (implCallCount <= 1) {
            return {
              exitCode: 1,
              messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "2 tests failed" }] }] as any,
              filesChanged: [],
              testsPassed: false,
              error: "test failures",
            };
          }
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true };
        }
        if (config.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await runPipeline(
      { taskDescription: "Build parser" },
      dispatcher,
      { cwd: "/project", pipelineId: "pipe-retry", agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }, skipLog: true },
    );

    expect(result.status).toBe("completed");
    expect(implCallCount).toBe(2);
    // Second impl call should have retry context
    expect(lastImplContext).toContain("Retry");
    expect(result.retryCount).toBe(1);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS — this should work with the implementation from Task 14 since retry on verify failure is already implemented. If it fails, adjust the pipeline-runner.

**Step 3 — Write minimal implementation**
No changes expected — verify failure retry is handled in Task 14's implementation.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 16: Pipeline runner — review rejection retry [depends: 14]

**Covers AC 6.**

**Files:**
- Modify: `tests/pipeline-runner.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-runner.test.ts`:

```ts
describe("runPipeline — review rejection retry", () => {
  it("re-runs implement → verify → review on rejection, with findings as context", async () => {
    let reviewCallCount = 0;
    let lastImplContext: string | undefined;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          lastImplContext = config.context;
          return { exitCode: 0, messages: [], filesChanged: ["src/foo.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true };
        }
        if (config.agent === "reviewer") {
          reviewCallCount++;
          if (reviewCallCount === 1) {
            return {
              exitCode: 0,
              messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: reject\n\n## Findings\n\n- Missing null check\n- No error handling" }] }] as any,
              filesChanged: [],
              testsPassed: null,
            };
          }
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await runPipeline(
      { taskDescription: "Build parser" },
      dispatcher,
      { cwd: "/project", pipelineId: "pipe-review", agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }, skipLog: true },
    );

    expect(result.status).toBe("completed");
    expect(reviewCallCount).toBe(2);
    // Second impl should have review findings in context
    expect(lastImplContext).toContain("Missing null check");
    expect(result.retryCount).toBe(1);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS — review rejection retry is handled in Task 14's implementation.

**Step 3 — Write minimal implementation**
No changes expected.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 17: Pipeline runner — retry budget exhaustion → paused [depends: 14]

**Covers AC 7.**

**Files:**
- Modify: `tests/pipeline-runner.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-runner.test.ts`:

```ts
describe("runPipeline — retry budget exhaustion", () => {
  it("returns paused after exhausting retry budget (default 3)", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          return { exitCode: 0, messages: [], filesChanged: ["src/foo.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return {
            exitCode: 1,
            messages: [],
            filesChanged: [],
            testsPassed: false,
            error: "tests always fail",
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await runPipeline(
      { taskDescription: "Build parser" },
      dispatcher,
      { cwd: "/project", pipelineId: "pipe-budget", agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }, maxRetries: 2, skipLog: true },
    );

    expect(result.status).toBe("paused");
    expect(result.error).toContain("Retry budget exhausted");
    expect(result.retryCount).toBeGreaterThanOrEqual(2);
  });

  it("respects custom retry budget", async () => {
    let implCount = 0;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          implCount++;
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: false };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    await runPipeline(
      { taskDescription: "test" },
      dispatcher,
      { cwd: "/project", pipelineId: "pipe-custom", agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }, maxRetries: 1, skipLog: true },
    );

    // 1 initial + 1 retry = 2 impl calls
    expect(implCount).toBe(2);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS — budget exhaustion is in Task 14's implementation.

**Step 3 — Write minimal implementation**
No changes expected.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 18: Pipeline runner — step timeout [depends: 14]

**Covers AC 9.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify: `tests/pipeline-runner.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-runner.test.ts`:

```ts
describe("runPipeline — step timeout", () => {
  it("treats a step timeout as a failure counting toward retry budget", async () => {
    let implCount = 0;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          implCount++;
          if (implCount === 1) {
            // Simulate timeout by returning a timeout error
            return {
              exitCode: 1,
              messages: [],
              filesChanged: [],
              testsPassed: null,
              error: "Step timed out after 600s",
            };
          }
          return { exitCode: 0, messages: [], filesChanged: ["src/foo.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true };
        }
        if (config.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await runPipeline(
      { taskDescription: "Build parser" },
      dispatcher,
      {
        cwd: "/project",
        pipelineId: "pipe-timeout",
        agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" },
        stepTimeoutMs: 100,
        skipLog: true,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.retryCount).toBe(1);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — the pipeline runner doesn't handle impl step errors as retry triggers yet (only verify failure/review rejection trigger retries, not impl errors).

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/subagent/pipeline-runner.ts` — in the implement step, add a check for `implResult.exitCode !== 0`:

After the implement step dispatch and parsing, add:

```ts
    // If implement step itself failed (timeout, crash), retry
    if (implResult.exitCode !== 0) {
      retryCount++;
      if (cycle >= maxRetries) {
        return {
          status: "paused",
          filesChanged: allFilesChanged,
          error: `Implement step failed: ${implParsed.error ?? "unknown error"}`,
          retryCount,
        };
      }
      context = setRetryContext(context, `Implement step failed: ${implParsed.error ?? "unknown error"}`);
      continue;
    }
```

Also add `timeoutMs: options.stepTimeoutMs` to each `dispatch` call.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 19: Pipeline runner — TDD report in review context [depends: 6, 14]

**Covers AC 16.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify: `tests/pipeline-runner.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-runner.test.ts`:

```ts
import { auditTddCompliance } from "../extensions/megapowers/subagent/tdd-auditor.js";

describe("runPipeline — TDD report in review context", () => {
  it("includes TDD compliance report in the review step's context", async () => {
    let reviewContext: string | undefined;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          return {
            exitCode: 0,
            messages: [
              {
                role: "assistant" as const,
                content: [
                  { type: "tool_use" as const, id: "1", name: "write", input: { path: "tests/a.test.ts", content: "test" } },
                  { type: "tool_use" as const, id: "2", name: "write", input: { path: "src/a.ts", content: "code" } },
                ],
              },
            ] as any,
            filesChanged: ["tests/a.test.ts", "src/a.ts"],
            testsPassed: null,
          };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true };
        }
        if (config.agent === "reviewer") {
          reviewContext = config.context;
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    await runPipeline(
      { taskDescription: "Build parser" },
      dispatcher,
      { cwd: "/project", pipelineId: "pipe-tdd", agents: { implementer: "implementer", verifier: "verifier", reviewer: "reviewer" }, skipLog: true },
    );

    expect(reviewContext).toBeDefined();
    expect(reviewContext).toContain("TDD");
    expect(reviewContext).toContain("testWrittenFirst");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — review context doesn't include TDD report yet

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/subagent/pipeline-runner.ts`:

1. Add import at top: `import { auditTddCompliance, type ToolCallRecord } from "./tdd-auditor.js";`
2. After the implement step, extract tool calls from messages and run TDD audit:

```ts
    // After implement step, audit TDD compliance
    const toolCalls: ToolCallRecord[] = [];
    for (const msg of implResult.messages) {
      if (!("content" in msg) || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (block.type === "tool_use") {
          toolCalls.push({ tool: block.name, args: block.input as Record<string, any> });
        }
      }
    }
    const tddReport = auditTddCompliance(toolCalls);
    const tddReportStr = JSON.stringify(tddReport);
```

3. Include `tddReport: tddReportStr` in the implement step's `appendStepOutput` call.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 20: Agent definitions — implementer agent [no-test]

**Justification:** Agent definition markdown files — no runtime code to test. Verified by checking the file exists and is parseable.

**Covers AC 31.**

**Files:**
- Create: `agents/implementer.md`

**Step 1 — Make the change**

Create `agents/implementer.md`:

```markdown
---
name: implementer
model: openai/gpt-5.3-codex
tools: [read, write, edit, bash, grep, find, ls]
thinking: low
---

You are an implementation agent executing a specific task using TDD (Test-Driven Development).

## TDD Process (strict order)

1. **Write the test first** — create or modify the test file as described in the task
2. **Run the test** — execute the test and confirm it fails with the expected error
3. **Write production code** — implement just enough to make the test pass
4. **Run the test again** — confirm the test now passes
5. **Run the full suite** — execute `bun test` to verify no regressions

## Rules

- Follow the task description precisely — do not add features not described
- Keep changes minimal and focused on the assigned task
- Read existing code before editing to understand conventions
- Do not refactor unrelated code
- If the task says [no-test], skip steps 1-2 and implement directly
- When done, summarize: files created, files modified, tests passing
- If you encounter ambiguity, report it clearly rather than guessing
```

**Step 2 — Verify**
Run: `cat agents/implementer.md | head -5`
Expected: shows frontmatter with `name: implementer`

---

### Task 21: Agent definitions — reviewer agent for pipeline [no-test]

**Justification:** Agent definition markdown file — no runtime code.

**Covers AC 32.**

**Files:**
- Create: `agents/pipeline-reviewer.md`

**Step 1 — Make the change**

Create `agents/pipeline-reviewer.md`:

```markdown
---
name: pipeline-reviewer
model: anthropic/claude-sonnet-4-6
tools: [read, bash, grep, find, ls]
thinking: high
---

You are a code reviewer for an automated pipeline. Evaluate the implementation against the acceptance criteria and task description provided in your context.

## Review Process

1. Read the changed files listed in the context
2. Check each acceptance criterion — is it satisfied by the implementation?
3. Evaluate the TDD compliance report — if tests were not written first, note it as a finding (not automatically blocking)
4. Run the test suite if needed to verify behavior
5. Check for: logic errors, missing error handling, broken tests, security concerns, architectural violations

## Verdict Format

End your review with exactly one of:

**Verdict: approve** — no blocking issues found
**Verdict: reject** — blocking issues must be fixed

## Findings

List each finding as a bullet point:
- [severity] file:line — description

Severity: **blocking** (must fix) or **suggestion** (nice to have).

Do not modify any files. Your output is read-only analysis.
```

**Step 2 — Verify**
Run: `cat agents/pipeline-reviewer.md | head -5`
Expected: shows frontmatter with `name: pipeline-reviewer`

---

### Task 22: Agent definitions — verifier agent [no-test]

**Justification:** Agent definition markdown file — no runtime code.

**Covers AC 33.**

**Files:**
- Create: `agents/verifier.md`

**Step 1 — Make the change**

Create `agents/verifier.md`:

```markdown
---
name: verifier
model: anthropic/claude-haiku-4-5
tools: [bash, read, grep]
thinking: low
---

You are a verification agent. Your sole job is to run the test suite and report whether tests pass or fail.

## Process

1. Run `bun test` in the project root
2. If tests pass, report success with a brief summary (pass count, duration)
3. If tests fail, report the failure details: which tests failed, error messages, and stack traces

## Output Format

Start with either:
- ✅ **All tests pass** — followed by summary
- ❌ **Tests failing** — followed by failure details

Include the raw test runner output for downstream analysis. Do not modify any files.
```

**Step 2 — Verify**
Run: `cat agents/verifier.md | head -5`
Expected: shows frontmatter with `name: verifier`

---

### Task 23: Pipeline tool — basic dispatch [depends: 14, 11, 12, 13]

**Covers AC 25, 26.**

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-tool.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/pipeline-tool.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  handlePipelineDispatch,
  type PipelineDispatchInput,
  type PipelineDispatchResult,
} from "../extensions/megapowers/subagent/pipeline-tool.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher, DispatchConfig } from "../extensions/megapowers/subagent/dispatcher.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function setupTestEnv() {
  const tmp = mkdtempSync(join(tmpdir(), "pipeline-tool-test-"));
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "implement",
    megaEnabled: true,
    completedTasks: [],
    currentTaskIndex: 0,
  });
  // Create plan.md with tasks
  const planDir = join(tmp, ".megapowers", "plans", "001-test");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "plan.md"), `# Plan\n\n### Task 1: Build types\n\nCreate types.\n\n### Task 2: Build parser [depends: 1]\n\nBuild it.\n`);
  return tmp;
}

describe("handlePipelineDispatch", () => {
  let tmp: string;

  beforeEach(() => { tmp = setupTestEnv(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("validates task index exists in plan", async () => {
    const mockDispatcher: Dispatcher = {
      async dispatch() { return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true }; },
    };
    const result = await handlePipelineDispatch(tmp, { taskIndex: 99 }, mockDispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(result.error).toContain("not found");
  });

  it("validates task dependencies are satisfied", async () => {
    const mockDispatcher: Dispatcher = {
      async dispatch() { return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true }; },
    };
    // Task 2 depends on task 1, which is not completed
    const result = await handlePipelineDispatch(tmp, { taskIndex: 2 }, mockDispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(result.error).toContain("depends on");
  });

  it("dispatches pipeline for valid task index", async () => {
    let dispatchCalled = false;
    const mockDispatcher: Dispatcher = {
      async dispatch(config) {
        dispatchCalled = true;
        if (config.agent === "reviewer" || config.agent === "pipeline-reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 0, messages: [], filesChanged: ["src/types.ts"], testsPassed: true };
      },
    };

    const result = await handlePipelineDispatch(tmp, { taskIndex: 1 }, mockDispatcher, async () => ({ code: 0, stdout: "", stderr: "" }));
    expect(result.error).toBeUndefined();
    expect(result.pipelineResult).toBeDefined();
    expect(result.pipelineResult!.status).toBe("completed");
    expect(dispatchCalled).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/pipeline-tool.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/pipeline-tool.ts

import { readState } from "../state/state-io.js";
import { deriveTasks } from "../state/derived.js";
import { validateTaskDependencies } from "./subagent-validate.js";
import { extractTaskSection } from "./subagent-context.js";
import { runPipeline, type PipelineResult } from "./pipeline-runner.js";
import { createPipelineWorkspace, type ExecJJ } from "./pipeline-workspace.js";
import type { Dispatcher } from "./dispatcher.js";
import { createStore } from "../state/store.js";
import { randomUUID } from "node:crypto";

export interface PipelineDispatchInput {
  taskIndex: number;
  resume?: boolean;
  guidance?: string;
}

export interface PipelineDispatchResult {
  pipelineId?: string;
  pipelineResult?: PipelineResult;
  error?: string;
}

export async function handlePipelineDispatch(
  cwd: string,
  input: PipelineDispatchInput,
  dispatcher: Dispatcher,
  execJJ: ExecJJ,
): Promise<PipelineDispatchResult> {
  const state = readState(cwd);

  if (!state.megaEnabled) return { error: "Megapowers is disabled." };
  if (!state.activeIssue) return { error: "No active issue." };
  if (state.phase !== "implement") return { error: "Pipeline can only be dispatched during implement phase." };

  const tasks = deriveTasks(cwd, state.activeIssue);
  const task = tasks.find(t => t.index === input.taskIndex);
  if (!task) return { error: `Task ${input.taskIndex} not found in plan.` };

  const validation = validateTaskDependencies(input.taskIndex, tasks, state.completedTasks);
  if (!validation.valid) {
    const reason = validation.unmetDependencies
      ? `Task ${input.taskIndex} depends on incomplete tasks: ${validation.unmetDependencies.join(", ")}`
      : validation.error ?? "Dependency validation failed.";
    return { error: reason };
  }

  const pipelineId = `pipe-t${input.taskIndex}-${randomUUID().slice(0, 8)}`;

  const store = createStore(cwd);
  const planContent = store.readPlanFile(state.activeIssue, "plan.md");
  const planSection = planContent ? extractTaskSection(planContent, input.taskIndex) : undefined;
  const specFile = state.workflow === "bugfix" ? "diagnosis.md" : "spec.md";
  const specContent = store.readPlanFile(state.activeIssue, specFile) ?? undefined;
  const learnings = store.getLearnings() || undefined;

  // Create jj workspace
  const wsResult = await createPipelineWorkspace(cwd, pipelineId, execJJ);
  if (wsResult.error) return { error: `Workspace creation failed: ${wsResult.error}` };

  const taskDescription = input.guidance
    ? `${task.description}\n\nGuidance: ${input.guidance}`
    : task.description;

  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      cwd: wsResult.workspacePath,
      pipelineId,
      agents: { implementer: "implementer", verifier: "verifier", reviewer: "pipeline-reviewer" },
    },
  );

  return { pipelineId, pipelineResult: result };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 24: Pipeline tool — pause and resume [depends: 23]

**Covers AC 27.**

**Files:**
- Modify: `tests/pipeline-tool.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-tool.test.ts`:

```ts
describe("handlePipelineDispatch — pause and resume", () => {
  let tmp: string;

  beforeEach(() => { tmp = setupTestEnv(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("returns paused result with log and error when pipeline exhausts retries", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          return { exitCode: 0, messages: [], filesChanged: ["src/types.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: false, error: "tests fail" };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await handlePipelineDispatch(
      tmp,
      { taskIndex: 1 },
      dispatcher,
      async () => ({ code: 0, stdout: "", stderr: "" }),
    );

    expect(result.pipelineResult).toBeDefined();
    expect(result.pipelineResult!.status).toBe("paused");
    expect(result.pipelineResult!.error).toContain("Retry budget");
  });

  it("accepts resume with guidance text", async () => {
    let lastContext: string | undefined;
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "implementer") {
          lastContext = config.context;
          return { exitCode: 0, messages: [], filesChanged: ["src/types.ts"], testsPassed: null };
        }
        if (config.agent === "verifier") {
          return { exitCode: 0, messages: [], filesChanged: [], testsPassed: true };
        }
        if (config.agent === "reviewer" || config.agent === "pipeline-reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null };
      },
    };

    const result = await handlePipelineDispatch(
      tmp,
      { taskIndex: 1, resume: true, guidance: "Focus on the edge case for empty input" },
      dispatcher,
      async () => ({ code: 0, stdout: "", stderr: "" }),
    );

    expect(result.pipelineResult).toBeDefined();
    expect(result.pipelineResult!.status).toBe("completed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS — the implementation from Task 23 already handles these cases (guidance is appended to task description, paused is returned from pipeline runner).

**Step 3 — Write minimal implementation**
No changes expected.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 25: Pipeline tool — completed → squash + task_done [depends: 23, 12]

**Covers AC 28.**

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Modify: `tests/pipeline-tool.test.ts` (append)

**Step 1 — Write the failing test**

Append to `tests/pipeline-tool.test.ts`:

```ts
import { readState } from "../extensions/megapowers/state/state-io.js";

describe("handlePipelineDispatch — squash on completed", () => {
  let tmp: string;

  beforeEach(() => { tmp = setupTestEnv(); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("squashes workspace and marks task done on completed pipeline", async () => {
    // Set up TDD state to allow task_done
    writeState(tmp, {
      ...readState(tmp),
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });

    const jjCalls: string[][] = [];
    const mockExecJJ: ExecJJ = async (args) => {
      jjCalls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    };

    const dispatcher: Dispatcher = {
      async dispatch(config) {
        if (config.agent === "reviewer" || config.agent === "pipeline-reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Verdict: approve" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }
        return { exitCode: 0, messages: [], filesChanged: ["src/types.ts"], testsPassed: true };
      },
    };

    const result = await handlePipelineDispatch(
      tmp,
      { taskIndex: 1 },
      dispatcher,
      mockExecJJ,
    );

    expect(result.pipelineResult!.status).toBe("completed");

    // Check that squash was called
    const squashCall = jjCalls.find(args => args[0] === "squash");
    expect(squashCall).toBeDefined();

    // Check that task was marked done in state
    const state = readState(tmp);
    expect(state.completedTasks).toContain(1);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: FAIL — `handlePipelineDispatch` doesn't squash or mark task done yet

**Step 3 — Write minimal implementation**

Modify `extensions/megapowers/subagent/pipeline-tool.ts`:

1. Add imports: `import { squashPipelineWorkspace, cleanupPipelineWorkspace } from "./pipeline-workspace.js";`
2. Add import: `import { handleSignal } from "../tools/tool-signal.js";`
3. After `runPipeline` returns, if status is "completed", squash and mark task done:

```ts
  if (result.status === "completed") {
    // Squash workspace changes back into parent
    await squashPipelineWorkspace(cwd, pipelineId, execJJ);

    // Mark task done via state machine
    handleSignal(cwd, "task_done");
  } else {
    // On pause, cleanup workspace
    await cleanupPipelineWorkspace(cwd, pipelineId, execJJ);
  }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

---

### Task 26: One-shot subagent tool [depends: 1, 2, 11, 12, 13]

**Covers AC 29, 30.**

**Files:**
- Create: `extensions/megapowers/subagent/oneshot-tool.ts`
- Test: `tests/oneshot-tool.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/oneshot-tool.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  handleOneshotDispatch,
  type OneshotInput,
} from "../extensions/megapowers/subagent/oneshot-tool.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import type { Dispatcher } from "../extensions/megapowers/subagent/dispatcher.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("handleOneshotDispatch", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "oneshot-test-"));
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

  it("dispatches a one-shot task and returns result", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(config) {
        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Found 5 relevant files" }] }] as any,
          filesChanged: ["src/a.ts"],
          testsPassed: null,
        };
      },
    };

    const jjCalls: string[][] = [];
    const result = await handleOneshotDispatch(
      tmp,
      { task: "Find all auth-related files" },
      dispatcher,
      async (args) => { jjCalls.push(args); return { code: 0, stdout: "", stderr: "" }; },
    );

    expect(result.error).toBeUndefined();
    expect(result.output).toContain("Found 5 relevant files");
    expect(result.filesChanged).toEqual(["src/a.ts"]);
  });

  it("squashes workspace on success", async () => {
    const jjCalls: string[][] = [];
    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [], filesChanged: ["src/a.ts"], testsPassed: null };
      },
    };

    await handleOneshotDispatch(
      tmp,
      { task: "Do something" },
      dispatcher,
      async (args) => { jjCalls.push(args); return { code: 0, stdout: "", stderr: "" }; },
    );

    const squashCall = jjCalls.find(args => args[0] === "squash");
    expect(squashCall).toBeDefined();
  });

  it("returns error when dispatch fails", async () => {
    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 1, messages: [], filesChanged: [], testsPassed: null, error: "crashed" };
      },
    };

    const result = await handleOneshotDispatch(
      tmp,
      { task: "Do something" },
      dispatcher,
      async () => ({ code: 0, stdout: "", stderr: "" }),
    );

    expect(result.error).toBe("crashed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/oneshot-tool.test.ts`
Expected: FAIL — cannot find module `../extensions/megapowers/subagent/oneshot-tool.js`

**Step 3 — Write minimal implementation**

```ts
// extensions/megapowers/subagent/oneshot-tool.ts

import { readState } from "../state/state-io.js";
import type { Dispatcher } from "./dispatcher.js";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  type ExecJJ,
} from "./pipeline-workspace.js";
import { parseStepResult } from "./pipeline-results.js";
import { randomUUID } from "node:crypto";

export interface OneshotInput {
  task: string;
  agent?: string;
  timeoutMs?: number;
}

export interface OneshotResult {
  id: string;
  output?: string;
  filesChanged?: string[];
  error?: string;
}

export async function handleOneshotDispatch(
  cwd: string,
  input: OneshotInput,
  dispatcher: Dispatcher,
  execJJ: ExecJJ,
): Promise<OneshotResult> {
  const state = readState(cwd);
  if (!state.megaEnabled) return { id: "", error: "Megapowers is disabled." };

  const id = `oneshot-${randomUUID().slice(0, 8)}`;

  // Create workspace
  const ws = await createPipelineWorkspace(cwd, id, execJJ);
  if (ws.error) return { id, error: `Workspace creation failed: ${ws.error}` };

  const result = await dispatcher.dispatch({
    agent: input.agent ?? "worker",
    task: input.task,
    cwd: ws.workspacePath,
    timeoutMs: input.timeoutMs,
  });

  const parsed = parseStepResult(result);

  if (result.exitCode === 0 && result.filesChanged.length > 0) {
    await squashPipelineWorkspace(cwd, id, execJJ);
  } else {
    await cleanupPipelineWorkspace(cwd, id, execJJ);
  }

  return {
    id,
    output: parsed.finalOutput || undefined,
    filesChanged: result.filesChanged.length > 0 ? result.filesChanged : undefined,
    error: result.error,
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

### Task 27: Clean slate — remove old subagent files and wire new tools [depends: 2, 23, 25, 26]

**Covers AC 34.**

**Files:**
- Delete: `extensions/megapowers/subagent/subagent-async.ts`
- Delete: `extensions/megapowers/subagent/subagent-runner.ts`
- Delete: `extensions/megapowers/subagent/subagent-status.ts`
- Delete: `extensions/megapowers/subagent/subagent-errors.ts`
- Delete: `tests/subagent-async.test.ts`
- Delete: `tests/subagent-runner.test.ts`
- Delete: `tests/subagent-status.test.ts`
- Delete: `tests/subagent-errors.test.ts`
- Modify: `extensions/megapowers/register-tools.ts` — replace subagent/subagent_status tools with `pipeline` and updated `subagent` tools
- Modify: `extensions/megapowers/satellite.ts` — remove dependency on deleted modules
- Modify: `extensions/megapowers/hooks.ts` — update any subagent imports
- Test: `tests/register-tools-pipeline.test.ts`

**Step 1 — Write the failing test**

```ts
// tests/register-tools-pipeline.test.ts
import { describe, it, expect } from "bun:test";

describe("clean slate verification", () => {
  it("old subagent-async module is removed", async () => {
    let threw = false;
    try {
      await import("../extensions/megapowers/subagent/subagent-async.js");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("old subagent-runner module is removed", async () => {
    let threw = false;
    try {
      await import("../extensions/megapowers/subagent/subagent-runner.js");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("old subagent-status module is removed", async () => {
    let threw = false;
    try {
      await import("../extensions/megapowers/subagent/subagent-status.js");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("new dispatcher module is importable", async () => {
    const mod = await import("../extensions/megapowers/subagent/dispatcher.js");
    expect(mod).toBeDefined();
  });

  it("new pipeline-runner module is importable", async () => {
    const mod = await import("../extensions/megapowers/subagent/pipeline-runner.js");
    expect(mod.runPipeline).toBeTypeOf("function");
  });

  it("new pipeline-tool module is importable", async () => {
    const mod = await import("../extensions/megapowers/subagent/pipeline-tool.js");
    expect(mod.handlePipelineDispatch).toBeTypeOf("function");
  });

  it("new oneshot-tool module is importable", async () => {
    const mod = await import("../extensions/megapowers/subagent/oneshot-tool.js");
    expect(mod.handleOneshotDispatch).toBeTypeOf("function");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools-pipeline.test.ts`
Expected: FAIL — old modules still exist (the "old module is removed" tests fail)

**Step 3 — Write minimal implementation**

1. Delete old files:
   - `rm extensions/megapowers/subagent/subagent-async.ts`
   - `rm extensions/megapowers/subagent/subagent-runner.ts`
   - `rm extensions/megapowers/subagent/subagent-status.ts`
   - `rm extensions/megapowers/subagent/subagent-errors.ts`
   - `rm tests/subagent-async.test.ts`
   - `rm tests/subagent-runner.test.ts`
   - `rm tests/subagent-status.test.ts`
   - `rm tests/subagent-errors.test.ts`

2. Update `extensions/megapowers/register-tools.ts`:
   - Remove all imports from deleted modules (`subagent-status`, `subagent-runner`, `subagent-errors`, `subagent-workspace` old functions)
   - Remove the old `subagent` tool registration (the fire-and-forget spawn logic)
   - Remove the old `subagent_status` tool registration
   - Add imports from new modules: `handlePipelineDispatch`, `handleOneshotDispatch`
   - Register a `pipeline` tool that calls `handlePipelineDispatch`
   - Register an updated `subagent` tool that calls `handleOneshotDispatch`

3. Update `extensions/megapowers/satellite.ts`:
   - Remove any imports from deleted modules (currently satellite.ts doesn't import from subagent modules, so this may be a no-op)

4. Update `extensions/megapowers/hooks.ts`:
   - No subagent imports exist in hooks.ts, so this is a no-op

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools-pipeline.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing (old test files deleted, remaining tests pass)