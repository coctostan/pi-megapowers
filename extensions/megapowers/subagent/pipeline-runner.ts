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

  // Safety net: only reachable if maxRetries < 0 (no iterations ran).
  const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
  return {
    status: "paused",
    filesChanged,
    retryCount,
    logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
    diff,
    errorSummary: "Pipeline exited without completing (maxRetries < 0?)",
  };
}
