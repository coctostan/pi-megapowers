import type { Dispatcher, DispatchConfig, DispatchResult } from "./dispatcher.js";
import { buildInitialContext, appendStepOutput, setRetryContext, renderContextPrompt } from "./pipeline-context.js";
import { parseStepResult, parseReviewVerdict } from "./pipeline-results.js";
import { writeLogEntry, readPipelineLog, type PipelineLogEntry } from "./pipeline-log.js";
import { extractToolCalls, extractTestOutput } from "./message-utils.js";
import { auditTddCompliance } from "./tdd-auditor.js";
import { getWorkspaceDiff, type ExecGit } from "./pipeline-workspace.js";

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

  execGit: ExecGit;
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
      context: renderContextPrompt(ctx),
      timeoutMs: stepTimeoutMs,
    });

    const implParsed = parseStepResult(impl);
    filesChanged = [...new Set([...filesChanged, ...implParsed.filesChanged])];

    // AC16: audit TDD compliance after implement
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
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
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
        const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
        return {
          status: "paused",
          filesChanged,
          retryCount,
          logEntries: readPipelineLog(options.projectRoot, options.pipelineId),
          diff,
          errorSummary: "Retry budget exhausted — tests still failing",
        };
      }

      // AC5: propagate raw failing test output to next implement cycle
      const testOutput = extractTestOutput(verify.messages);
      const failureDetail = testOutput || verifyParsed.finalOutput || verifyParsed.error || "unknown";
      ctx = setRetryContext(ctx, `Verify failed:\n\n${failureDetail}`);
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
    if (review.exitCode !== 0) {
      ctx = appendStepOutput(ctx, {
        step: "review",
        filesChanged: [],
        finalOutput: reviewParsed.finalOutput,
        error: reviewParsed.error,
      });

      writeLogEntry(options.projectRoot, options.pipelineId, {
        step: "review",
        status: "failed",
        durationMs: Date.now() - t2,
        summary: "review failed",
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
        };
      }

      ctx = setRetryContext(ctx, `Review step failed: ${reviewParsed.error ?? "unknown"}`);
      continue;
    }

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
        testOutput: [verifyParsed.finalOutput, extractTestOutput(verify.messages) ?? ""].filter(Boolean).join("\n\n"),
        reviewVerdict: "approve",
        reviewFindings: verdict.findings,
      };
    }
    // AC6: review rejection triggers full re-run with findings
    retryCount++;
    if (cycle >= maxRetries) {
      const { diff } = await getWorkspaceDiff(options.workspaceCwd, options.execGit);
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
