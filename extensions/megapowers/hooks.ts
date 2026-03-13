import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { showDoneChecklist } from "./ui.js";
import { evaluateWriteOverride, recordTestFileWritten } from "./tools/tool-overrides.js";
import { runFocusedReviewFanout, type FocusedReviewFanoutResult } from "./plan-review/focused-review-runner.js";
import { shouldRunFocusedReview } from "./plan-orchestrator.js";
import { isSubagentSession } from "./subagent-session.js";

// --- Hook handlers ---

export async function onContext(_event: any, _ctx: any, _deps: Deps): Promise<any> {
  // No-op: context hook should not replace messages.
  // Previously called ctx.sessionManager.buildSessionContext() which is not a valid API method.
  return;
}


export async function onSessionStart(_event: any, ctx: any, deps: Deps): Promise<void> {
  const { store, ui } = deps;

  // Read state from disk (authoritative source of truth)
  const state = readState(ctx.cwd);

  // Reset megaEnabled to true on every session start (AC40)
  if (!state.megaEnabled) {
    writeState(ctx.cwd, { ...state, megaEnabled: true });
  }


  // Render dashboard
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
}

export async function preparePlanReviewContext(
  cwd: string,
  runFocusedReviewFanoutFn: typeof runFocusedReviewFanout = runFocusedReviewFanout,
): Promise<FocusedReviewFanoutResult | void> {
  const state = readState(cwd);
  if (state.phase !== "plan" || state.planMode !== "review" || !state.activeIssue || !state.workflow) {
    return;
  }

  if (isSubagentSession()) return;

  const taskCount = deriveTasks(cwd, state.activeIssue).length;
  if (!shouldRunFocusedReview(state.planMode, taskCount)) return;

  try {
    return await runFocusedReviewFanoutFn({
      cwd,
      issueSlug: state.activeIssue,
      workflow: state.workflow,
      taskCount,
    });
  } catch {
    return;
  }
}

export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;
  await preparePlanReviewContext(ctx.cwd);
  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;
  return {
    message: {
      customType: "megapowers-context",
      content: prompt,
      display: false,
    },
  };
}

export async function onToolCall(event: any, ctx: any, _deps: Deps): Promise<any> {
  const toolName = event.toolName;
  if (toolName !== "write" && toolName !== "edit") return;

  const filePath: string | undefined = (event.input as any)?.path;
  if (!filePath) return;

  const decision = evaluateWriteOverride(ctx.cwd, filePath, toolName as "write" | "edit");
  if (!decision.allowed) {
    return { block: true, reason: decision.reason };
  }
}

export async function onToolResult(event: any, ctx: any, _deps: Deps): Promise<void> {
  const toolName = event.toolName;

  if ((toolName === "write" || toolName === "edit") && !event.isError) {
    const filePath: string | undefined = (event.input as any)?.path;
    if (filePath) {
      const decision = evaluateWriteOverride(ctx.cwd, filePath, toolName as "write" | "edit");
      if (decision.updateTddState) {
        recordTestFileWritten(ctx.cwd);
      }
    }
  }
}

export async function onAgentEnd(event: any, ctx: any, deps: Deps): Promise<void> {
  const { store, ui } = deps;
  const state = readState(ctx.cwd);
  if (!state.activeIssue || !state.phase) return;
  const phase = state.phase;
  // Deferred done checklist — fires after agent turn completes (#083 fix)
  if (phase === "done" && state.doneActions.length === 0 && state.activeIssue && !state.doneChecklistShown) {
    await showDoneChecklist(ctx, ctx.cwd);
    writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });
    return;
  }
  // Refresh dashboard after agent turn (AC9, AC10 — no blocking popup)
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
}
