import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { createInitialState } from "./state/state-machine.js";
import { squashAndPush } from "./vcs/branch-manager.js";
import { createPR } from "./vcs/pr-creator.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { showDoneChecklist } from "./ui.js";
import { evaluateWriteOverride, recordTestFileWritten } from "./tools/tool-overrides.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";

// --- Helpers ---

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
  return "role" in m && (m as any).role === "assistant" && Array.isArray((m as any).content);
}

function getAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

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

export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;

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

  // Done-phase action processing
  if (phase === "done" && state.doneActions.length > 0) {
    const doneAction = state.doneActions[0];
    // Immediate actions — no LLM content needed
    if (doneAction === "close-issue") {
      // Close source issues first (batch auto-close) before updating the batch issue
      const sources = store.getSourceIssues(state.activeIssue);
      for (const source of sources) {
        store.updateIssueStatus(source.slug, "done");
      }
      store.updateIssueStatus(state.activeIssue, "done");
      // Reset state fully to idle — only preserve megaEnabled
      writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
      if (ctx.hasUI) {
        const sourceInfo = sources.length > 0 ? ` (+ ${sources.length} source issues)` : "";
        ctx.ui.notify(`Issue ${state.activeIssue} marked as done${sourceInfo}`, "info");
      }
      return;
    }

    if (doneAction === "push-and-pr") {
      // AC18: Push & create PR
      if (!deps.execGit || !state.branchName) {
        // No VCS available or no branch tracked — skip and consume
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: No branch tracked — skipping push & PR.", "info");
        return;
      }

      if (!state.baseBranch) {
        // base branch unknown — can't safely squash. Degrade gracefully by consuming the action.
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("VCS: baseBranch is missing — skipping push & PR.", "error");
        return;
      }

      // Check whether the local feature branch still exists.
      // If it was deleted after merging (e.g. git branch -d feat/...), the push
      // would permanently fail with "src refspec does not match any". Skip and
      // consume the action so close-issue can run (FC1, FC3 — BUG #087).
      try {
        await deps.execGit(["rev-parse", "--verify", state.branchName]);
      } catch {
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
        if (ctx.hasUI) ctx.ui.notify("Feature branch not found locally — push skipped. PR may already be merged.", "info");
        return;
      }

      const baseBranch = state.baseBranch;
      const issue = store.getIssue(state.activeIssue);
      const commitPrefix = state.workflow === "bugfix" ? "fix" : "feat";
      const commitMsg = `${commitPrefix}: ${issue?.title ?? state.activeIssue}`;

      const pushResult = await squashAndPush(deps.execGit, state.branchName, baseBranch, commitMsg);
      if (!pushResult.ok) {
        // AC19: don't consume action on failure — user can retry
        if (ctx.hasUI) ctx.ui.notify(`Push failed (${pushResult.step}): ${pushResult.error}`, "error");
        return;
      }

      // Push succeeded — attempt PR creation
      if (deps.execCmd) {
        const prTitle = issue?.title ?? state.activeIssue;
        const prBody = `Resolves ${state.activeIssue}\n\n${issue?.description ?? ""}`.trim();
        const prResult = await createPR(deps.execCmd, state.branchName, prTitle, prBody);

        if ("skipped" in prResult) {
          // AC20: pushed but no PR
          if (ctx.hasUI) ctx.ui.notify(`Branch pushed. PR creation skipped: ${prResult.reason}`, "info");
        } else if (prResult.ok) {
          if (ctx.hasUI) ctx.ui.notify(`PR created: ${prResult.url}`, "info");
        } else {
          if (ctx.hasUI) ctx.ui.notify(`PR creation failed: ${prResult.error}`, "error");
        }
      } else {
        if (ctx.hasUI) ctx.ui.notify("Branch pushed. PR creation skipped (no execCmd).", "info");
      }

      // Consume action once push succeeds (even if PR creation fails)
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      return;
    }

    // Content-capture actions — need LLM-generated text > 100 chars
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (lastAssistant) {
      const text = getAssistantText(lastAssistant);
      if (text && text.length > 100) {
        if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") {
          store.writeFeatureDoc(state.activeIssue, text);
          if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
        }
        if (doneAction === "write-changelog") {
          store.appendChangelog(text);
          if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
        }
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      }
    }
  }

  // Refresh dashboard after agent turn (AC9, AC10 — no blocking popup)
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
}
