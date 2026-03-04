---
id: 14
title: "Refactor runPipeline: shell verify, frontmatter review, bounded context,
  structured result with infrastructure error separation"
status: approved
depends_on:
  - 2
  - 3
  - 4
  - 5
  - 12
  - 13
no_test: false
files_to_modify:
  - extensions/megapowers/subagent/pipeline-runner.ts
  - extensions/megapowers/subagent/pipeline-tool.ts
  - tests/pipeline-runner.test.ts
  - tests/pipeline-tool.test.ts
files_to_create: []
---

### Task 14: Refactor runPipeline: shell verify, frontmatter review, bounded context, structured result with infrastructure error separation [depends: 2, 3, 4, 5, 12, 13]

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-runner.ts`
- Modify: `extensions/megapowers/subagent/pipeline-tool.ts`
- Test: `tests/pipeline-runner.test.ts`

**Step 1 — Write the failing test**

Replace the entire `tests/pipeline-runner.test.ts`:

```typescript
// tests/pipeline-runner.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPipeline } from "../extensions/megapowers/subagent/pipeline-runner.js";
import type { Dispatcher, DispatchConfig, DispatchResult } from "../extensions/megapowers/subagent/dispatcher.js";
import type { ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "pipeline-runner-"));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function mkDispatch(exitCode: number, extra?: Partial<DispatchResult>): DispatchResult {
  return {
    exitCode,
    messages: [],
    filesChanged: [],
    testsPassed: null,
    ...extra,
  };
}

const passingShell: ExecShell = async () => ({
  exitCode: 0,
  stdout: "3 pass\n0 fail",
  stderr: "",
});

const failingShell: ExecShell = async () => ({
  exitCode: 1,
  stdout: "2 pass\n1 fail\nERROR: expected true to be false at tests/foo.test.ts:12",
  stderr: "",
});

describe("runPipeline (refactored)", () => {
  it("happy path: implement -> shell verify -> frontmatter review => completed", async () => {
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
        if (cfg.agent === "reviewer") {
          return mkDispatch(0, {
            messages: [{
              role: "assistant" as const,
              content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n\nLooks good.\n\n- Clean code" }],
            }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Do task", planSection: "### Task 1" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "pipe",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.filesChanged).toEqual(["src/a.ts"]);
    expect(r.reviewVerdict).toBe("approve");
    expect(r.testsPassed).toBe(true);
    expect(r.testOutput).toContain("3 pass");
    expect(r.infrastructureError).toBeUndefined();
    // Only 2 agents dispatched (no verifier)
    expect(called).toEqual(["implementer", "reviewer"]);
  });

  it("verify failure retries with bounded test output (not accumulated)", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, { messages: [] as any });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: failingShell,
        maxRetries: 1,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(implCount).toBe(2);
    expect(r.errorSummary).toContain("Retry budget exhausted");
    expect(r.infrastructureError).toBeUndefined();
    expect(secondImplContext).toBeDefined();
    expect(secondImplContext).toContain("expected true to be false");
    expect(secondImplContext).toContain("verify_failed");
  });

  it("review rejection retries with findings in bounded context", async () => {
    const called: string[] = [];
    let cycle = 0;
    let secondCycleImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        called.push(cfg.agent);
        if (cfg.agent === "implementer") {
          if (cycle === 1) secondCycleImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        if (cfg.agent === "reviewer") {
          if (cycle === 0) {
            cycle++;
            return mkDispatch(0, {
              messages: [{
                role: "assistant" as const,
                content: [{
                  type: "text" as const,
                  text: "---\nverdict: reject\n---\n\n- Missing error handling in parser\n- No edge case coverage",
                }],
              }] as any,
            });
          }
          return mkDispatch(0, {
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
          });
        }
        return mkDispatch(1, { error: "unknown" });
      },
    };

    const r = await runPipeline(
      { taskDescription: "Implement parser" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 3,
        execGit: async (args) => {
          if (args.includes("--stat")) return { stdout: "src/a.ts | 2 ++\n", stderr: "" };
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("completed");
    expect(r.reviewVerdict).toBe("approve");
    expect(r.infrastructureError).toBeUndefined();
    // 2 agents per cycle × 2 cycles = 4 dispatches (no verifier)
    expect(called).toEqual(["implementer", "reviewer", "implementer", "reviewer"]);
    expect(secondCycleImplContext).toContain("Missing error handling in parser");
    expect(secondCycleImplContext).toContain("review_rejected");
  });

  it("infrastructure failures (timeout) populate infrastructureError, not domain fields (AC26)", async () => {
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
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(tries).toBe(1);
    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(r.errorSummary).toContain("TimeoutError");
    // Domain fields NOT populated for infra failures
    expect(r.testsPassed).toBeUndefined();
    expect(r.reviewVerdict).toBeUndefined();
  });

  it("verify infrastructure failure populates infrastructureError", async () => {
    const dispatcher: Dispatcher = { async dispatch() { return mkDispatch(0, { messages: [] as any }); } };
    const throwingShell: ExecShell = async () => { throw new Error("spawn ENOENT"); };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      { projectRoot, workspaceCwd: join(projectRoot, "ws"), pipelineId: "p", agents: { implementer: "implementer", reviewer: "reviewer" }, execGit: async () => ({ stdout: "", stderr: "" }), execShell: throwingShell, maxRetries: 0 },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("ENOENT");
    expect(r.testsPassed).toBeUndefined();
  });

  it("review rejection pause includes reviewVerdict and reviewFindings", async () => {
    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(0, {
          messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: reject\n---\n\n- Missing error handling" }] }] as any,
        });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 0,
        execGit: async (args) => {
          if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat"))
            return { stdout: "diff --git ...", stderr: "" };
          return { stdout: "", stderr: "" };
        },
      },
    );

    expect(r.status).toBe("paused");
    expect(r.reviewVerdict).toBe("reject");
    expect(r.reviewFindings).toContain("Missing error handling");
    expect(r.errorSummary).toContain("review still rejecting");
  });

  it("reviewer dispatch failure uses review_failed retry reason and populates infrastructureError", async () => {
    let implCount = 0;
    let secondImplContext: string | undefined;

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "implementer") {
          implCount++;
          if (implCount === 2) secondImplContext = cfg.context;
          return mkDispatch(0, {
            messages: [
              { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/a.ts" } }] },
            ] as any,
          });
        }
        return mkDispatch(1, { error: "TimeoutError: reviewer timed out", messages: [] as any });
      },
    };

    const r = await runPipeline(
      { taskDescription: "x" },
      dispatcher,
      {
        projectRoot,
        workspaceCwd: join(projectRoot, "workspace"),
        pipelineId: "p",
        agents: { implementer: "implementer", reviewer: "reviewer" },
        testCommand: "bun test",
        execShell: passingShell,
        maxRetries: 1,
        execGit: async () => ({ stdout: "", stderr: "" }),
      },
    );

    expect(r.status).toBe("paused");
    expect(r.infrastructureError).toContain("TimeoutError");
    expect(implCount).toBe(2);
    expect(secondImplContext).toContain("review_failed");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: FAIL — `PipelineAgents` missing `verifier` field / `execShell` not in `PipelineOptions` / `testCommand` not in `PipelineOptions` / `infrastructureError` not in `PipelineResult`.

**Step 3 — Write minimal implementation**

Rewrite `extensions/megapowers/subagent/pipeline-runner.ts`:

```typescript
import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import { buildInitialContext, withRetryContext, renderContextPrompt } from "./pipeline-context-bounded.js";
import { parseStepResult, parseReviewOutput } from "./pipeline-results.js";
import { writeLogEntry, readPipelineLog, type PipelineLogEntry } from "./pipeline-log.js";
import { extractToolCalls } from "./message-utils.js";
import { auditTddCompliance } from "./tdd-auditor.js";
import { getWorkspaceDiff, type ExecGit } from "./pipeline-workspace.js";
import { runVerifyStep, type ExecShell } from "./pipeline-steps.js";

export interface PipelineAgents {
  implementer: string;
  reviewer: string;
}

export interface PipelineOptions {
  projectRoot: string;
  workspaceCwd: string;
  pipelineId: string;
  agents: PipelineAgents;

  maxRetries?: number;
  stepTimeoutMs?: number;

  execGit: ExecGit;
  testCommand?: string;
  execShell?: ExecShell;
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

  logEntries?: PipelineLogEntry[];
  diff?: string;
  errorSummary?: string;
  infrastructureError?: string;
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

const defaultExecShell: ExecShell = async (cmd, cwd) => {
  const { exec } = await import("child_process");
  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        exitCode: error && typeof (error as any).code === "number" ? (error as any).code : error ? 1 : 0,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
      });
    });
  });
};

export async function runPipeline(
  input: { taskDescription: string; planSection?: string; specContent?: string; learnings?: string },
  dispatcher: Dispatcher,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const maxRetries = options.maxRetries ?? 3;
  const stepTimeoutMs = options.stepTimeoutMs ?? 10 * 60 * 1000;
  const testCommand = options.testCommand ?? "bun test";
  const execShell = options.execShell ?? defaultExecShell;

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
      context: renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const implParsed = parseStepResult(impl);
    filesChanged = [...new Set([...filesChanged, ...implParsed.filesChanged])];

    const toolCalls = extractToolCalls(impl.messages);
    const tddReport = auditTddCompliance(toolCalls);

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
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — implement failed: ${implParsed.error ?? "unknown"}`,
          infrastructureError: implParsed.error,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "implement_failed",
        detail: implParsed.error ?? "unknown",
      });
      continue;
    }

    // ---------------- verify (shell command) ----------------
    const t1 = Date.now();
    let verify: { passed: boolean; exitCode: number; output: string; durationMs: number };
    try {
      verify = await runVerifyStep(testCommand, options.workspaceCwd, execShell);
    } catch (verifyErr) {
      const verifyMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      writeLogEntry(options.projectRoot, options.pipelineId, {
        step: "verify",
        status: "failed",
        durationMs: Date.now() - t1,
        summary: "verify infrastructure failure",
        error: verifyMsg,
      });
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — verify infrastructure failure: ${verifyMsg}`,
          infrastructureError: verifyMsg,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: verifyMsg,
      });
      continue;
    }
    writeLogEntry(options.projectRoot, options.pipelineId, {
      step: "verify",
      status: verify.passed ? "completed" : "failed",
      durationMs: verify.durationMs,
      summary: verify.passed ? "tests passed" : "tests failed",
      error: verify.passed ? undefined : `exit code ${verify.exitCode}`,
    });
    if (!verify.passed) {
      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          testsPassed: false,
          testOutput: verify.output,
          errorSummary: "Retry budget exhausted — tests still failing",
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: verify.output,
      });
      continue;
    }

    // ---------------- review (frontmatter-parsed) ----------------
    const t2 = Date.now();
    const { diff: reviewDiff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
    const review = await safeDispatch(dispatcher, {
      agent: options.agents.reviewer,
      task: `Review the implementation. Output your verdict as frontmatter:\n---\nverdict: approve\n---\nor\n---\nverdict: reject\n---\nThen list findings as bullet points.`,
      cwd: options.workspaceCwd,
      context: [
        renderContextPrompt(ctx),
        `## Test Results\n\n${verify.output}`,
        `## TDD Audit\n\n${JSON.stringify(tddReport)}`,
        reviewDiff ? `## Diff\n\n\`\`\`\n${reviewDiff}\n\`\`\`` : "",
      ].filter(Boolean).join("\n\n"),
      timeoutMs: stepTimeoutMs,
    });

    const reviewParsed = parseStepResult(review);

    if (review.exitCode !== 0) {
      writeLogEntry(options.projectRoot, options.pipelineId, {
        step: "review",
        status: "failed",
        durationMs: Date.now() - t2,
        summary: "review dispatch failed",
        error: reviewParsed.error,
      });

      retryCount++;
      if (cycle >= maxRetries) {
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: `Retry budget exhausted — review failed: ${reviewParsed.error ?? "unknown"}`,
          infrastructureError: reviewParsed.error,
        };
      }
      ctx = withRetryContext(ctx, {
        reason: "review_failed",
        detail: `Review dispatch failed: ${reviewParsed.error ?? "unknown"}`,
      });
      continue;
    }

    const verdict = parseReviewOutput(reviewParsed.finalOutput);

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
        testOutput: verify.output,
        reviewVerdict: "approve",
        reviewFindings: verdict.findings,
      };
    }

    retryCount++;
    if (cycle >= maxRetries) {
      const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
      return {
        status: "paused",
        filesChanged,
        retryCount,
        logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
        diff,
        reviewVerdict: "reject",
        reviewFindings: verdict.findings,
        errorSummary: "Retry budget exhausted — review still rejecting",
      };
    }
    ctx = withRetryContext(ctx, {
      reason: "review_rejected",
      detail: verdict.findings.join("\n"),
    });
  }

  const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
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

Also update `extensions/megapowers/subagent/pipeline-tool.ts`:

1. Remove verifier from agents line (~113):

```typescript
    agents: { implementer: "implementer", reviewer: "reviewer" },
```

2. Add `execShell` import and parameter to `handlePipelineTool`, and pass it through to `runPipeline`:

```typescript
import type { ExecShell } from "./pipeline-steps.js";

export async function handlePipelineTool(
  projectRoot: string,
  input: PipelineToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
  execShell?: ExecShell,
): Promise<PipelineToolOutput> {
  // ... existing validation code unchanged ...

  const result = await runPipeline(
    { taskDescription, planSection, specContent, learnings },
    dispatcher,
    {
      projectRoot,
      workspaceCwd: workspacePath,
      pipelineId,
      agents: { implementer: "implementer", reviewer: "reviewer" },
      execGit,
      execShell,
    },
  );
  // ... rest unchanged ...
}
```

3. Update `tests/pipeline-tool.test.ts` to work with the new runner (no verifier, shell-based verify, frontmatter reviewer):

Add import at the top:

```typescript
import type { ExecShell } from "../extensions/megapowers/subagent/pipeline-steps.js";
```

Replace the "on completed pipeline" test (~line 77):

```typescript
  it("on completed pipeline, squashes workspace and marks the specified task done even with null TDD state", async () => {
    tmp = setup(`# Plan\n\n### Task 1: First\n\nX\n\n### Task 2: Second\n\nY\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      return { stdout: "", stderr: "" };
    };

    const mockExecShell: ExecShell = async () => ({
      exitCode: 0,
      stdout: "1 pass\n0 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch(cfg) {
        if (cfg.agent === "reviewer") {
          return {
            exitCode: 0,
            messages: [{ role: "assistant" as const, content: [{ type: "text" as const, text: "---\nverdict: approve\n---\n" }] }] as any,
            filesChanged: [],
            testsPassed: null,
          };
        }

        return {
          exitCode: 0,
          messages: [{ role: "assistant" as const, content: [{ type: "tool_use" as const, id: "w", name: "write", input: { path: "src/x.ts" } }] }] as any,
          filesChanged: [],
          testsPassed: null,
        };
      },
    };

    const r = await handlePipelineTool(tmp, { taskIndex: 2 }, dispatcher, execGit, mockExecShell);
    expect(r.error).toBeUndefined();
    expect(r.result?.status).toBe("completed");

    expect(gitCalls.some((c) => c.args.includes("worktree") && c.args.includes("remove"))).toBe(true);

    const state = readState(tmp);
    expect(state.completedTasks).toContain(2);
  });
```

Replace the "paused pipeline" test (~line 128):

```typescript
  it("paused pipeline returns log + diff + errorSummary (AC27) and resume reuses workspace", async () => {
    tmp = setup(`# Plan\n\n### Task 1: Do thing\n\nDo it.\n`);

    const gitCalls: any[] = [];
    const execGit = async (args: string[]) => {
      gitCalls.push({ args });
      if (args.includes("--stat")) return { stdout: "src/file.ts | 1 +\n", stderr: "" };
      if (args.includes("diff") && args.includes("--cached") && !args.includes("--stat")) return { stdout: "diff --git a/src/file.ts b/src/file.ts\n+new code", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const failingExecShell: ExecShell = async () => ({
      exitCode: 1,
      stdout: "0 pass\n1 fail",
      stderr: "",
    });

    const dispatcher: Dispatcher = {
      async dispatch() {
        return { exitCode: 0, messages: [] as any, filesChanged: [], testsPassed: null };
      },
    };

    const first = await handlePipelineTool(tmp, { taskIndex: 1 }, dispatcher, execGit, failingExecShell);
    expect(first.result?.status).toBe("paused");

    expect(first.paused).toBeDefined();
    expect(typeof first.paused?.errorSummary).toBe("string");
    expect((first.paused?.errorSummary ?? "").length).toBeGreaterThan(0);
    expect(Array.isArray(first.paused?.log)).toBe(true);
    expect((first.paused?.log ?? []).length).toBeGreaterThan(0);
    expect(first.paused?.diff).toContain("diff --git");

    const adds = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;

    const second = await handlePipelineTool(tmp, { taskIndex: 1, resume: true, guidance: "try again" }, dispatcher, execGit, failingExecShell);
    expect(second.result?.status).toBe("paused");

    const addsAfter = gitCalls.filter((c) => c.args.includes("worktree") && c.args.includes("add")).length;
    expect(addsAfter).toBe(adds);
  });
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-runner.test.ts`
Expected: PASS
Run: `bun test tests/pipeline-tool.test.ts`
Expected: PASS — pipeline-tool tests use the new `execShell` parameter, frontmatter reviewer mocks, and shell-based verify mocks.
Run: `bun test`
Expected: all passing — no test references the removed `verifier` agent.
