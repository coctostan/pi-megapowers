import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { checkJJAvailability } from "./jj.js";
import { JJ_INSTALL_MESSAGE, JJ_INIT_MESSAGE } from "./jj-messages.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
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

export async function onContext(_event: any, ctx: any, _deps: Deps): Promise<any> {
  const state = readState(ctx.cwd);
  if (!state.megaEnabled) return;
  const sessionContext = ctx.sessionManager.buildSessionContext();
  return { messages: sessionContext.messages };
}


export async function onSessionStart(_event: any, ctx: any, deps: Deps): Promise<void> {
  const { store, jj, ui, pi } = deps;

  // Read state from disk (authoritative source of truth)
  const state = readState(ctx.cwd);

  // Reset megaEnabled to true on every session start (AC40)
  if (!state.megaEnabled) {
    writeState(ctx.cwd, { ...state, megaEnabled: true });
  }

  // jj validation: check for change ID mismatch
  const currentState = readState(ctx.cwd);
  if (currentState.activeIssue && currentState.jjChangeId && await jj.isJJRepo()) {
    const currentId = await jj.getCurrentChangeId();
    if (currentId && !currentId.startsWith(currentState.jjChangeId) && !currentState.jjChangeId.startsWith(currentId)) {
      // Auto-update stored change ID and notify (select dialog is broken during session_start — see #061)
      writeState(ctx.cwd, { ...currentState, jjChangeId: currentId });
      if (ctx.hasUI) {
        ctx.ui.notify(`jj change updated: ${currentState.jjChangeId.slice(0, 8)} → ${currentId.slice(0, 8)} for ${currentState.activeIssue}`);
      }
    }
  }

  // jj availability check — informational only, does not block (AC1-4)
  const jjStatus = await checkJJAvailability(
    () => pi.exec("jj", ["version"]),
    () => pi.exec("jj", ["root"]),
  );
  if (ctx.hasUI) {
    if (jjStatus === "not-installed") {
      ctx.ui.notify(JJ_INSTALL_MESSAGE);
    } else if (jjStatus === "not-repo") {
      ctx.ui.notify(JJ_INIT_MESSAGE);
    }
  }

  // Render dashboard
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
}

export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store, jj } = deps;

  const prompt = buildInjectedPrompt(ctx.cwd, store, jj);
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

  // Done-phase artifact capture (when LLM generates content from done actions prompt)
  if (phase === "done" && state.doneActions.length > 0) {
    const doneAction = state.doneActions[0];
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
