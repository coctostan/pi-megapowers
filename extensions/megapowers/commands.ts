import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createStore, type Store } from "./state/store.js";
import { createJJ, type JJ } from "./jj.js";
import { createUI, filterTriageableIssues, formatTriageIssueList, showDoneChecklist, type MegapowersUI } from "./ui.js";
import { readState, writeState } from "./state/state-io.js";
import { loadPromptFile, interpolatePrompt } from "./prompts.js";
import { handleSignal } from "./tools/tool-signal.js";
import { deriveTasks } from "./state/derived.js";

/** Mutable container — exactly one instance lives in index.ts, shared by all hooks and commands */
export type RuntimeDeps = { store?: Store; jj?: JJ; ui?: MegapowersUI };

/** Resolved deps — guaranteed non-optional */
export type Deps = { pi: ExtensionAPI; store: Store; jj: JJ; ui: MegapowersUI };

/**
 * The ONLY place allowed to create store/jj/ui.
 * Mutates runtimeDeps in-place so hooks and commands always share instances.
 */
export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.jj) rd.jj = createJJ(pi);
  if (!rd.ui) rd.ui = createUI();
  return { pi, store: rd.store, jj: rd.jj, ui: rd.ui };
}

// --- Command handlers ---

export async function handleMegaCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim().toLowerCase();

  if (sub === "off") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: false });
    // Hide custom tools from LLM (AC38)
    const activeTools = deps.pi.getActiveTools().filter(
      (t: string) => t !== "megapowers_signal" && t !== "megapowers_save_artifact" && t !== "subagent" && t !== "pipeline"
    );
    deps.pi.setActiveTools(activeTools);
    if (ctx.hasUI) ctx.ui.notify("Megapowers OFF — all enforcement disabled.", "info");
    return;
  }

  if (sub === "on") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: true });
    // Restore custom tools (AC38)
    const activeTools = deps.pi.getActiveTools();
    const toolsToAdd = ["megapowers_signal", "megapowers_save_artifact", "subagent", "pipeline"];
    const missing = toolsToAdd.filter((t: string) => !activeTools.includes(t));
    if (missing.length > 0) {
      deps.pi.setActiveTools([...activeTools, ...missing]);
    }
    if (ctx.hasUI) ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
    return;
  }

  deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
}

export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const state = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, state, deps.store, deps.jj, args);
  writeState(ctx.cwd, newState);
}

export async function handleTriageCommand(_args: string, ctx: any, deps: Deps): Promise<void> {
  const issues = filterTriageableIssues(deps.store.listIssues());
  if (issues.length === 0) {
    if (ctx.hasUI) ctx.ui.notify("No open issues to triage.", "info");
    return;
  }
  const issueList = formatTriageIssueList(issues);
  const template = loadPromptFile("triage.md");
  const prompt = interpolatePrompt(template, { open_issues: issueList });
  deps.pi.sendUserMessage(prompt);
}

export async function handlePhaseCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim().toLowerCase();

  if (sub === "next" || (sub !== "" && sub !== "status")) {
    // "next" uses default forward transition; any other non-empty string is a target phase
    const target = sub === "next" ? undefined : sub;
    const result = handleSignal(ctx.cwd, "phase_next", deps.jj, target);
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) {
        ctx.ui.notify(result.message ?? "Phase advanced.", "info");
        deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
      }
    }
  } else {
    const state = readState(ctx.cwd);
    if (state.phase && state.workflow) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Phase: ${state.phase}\nWorkflow: ${state.workflow}\nIssue: ${state.activeIssue ?? "none"}`,
          "info"
        );
      }
    } else {
      if (ctx.hasUI) ctx.ui.notify("No active workflow. Use /issue to start.", "info");
    }
  }
}

export async function handleDoneCommand(_args: string, ctx: any, deps: Deps): Promise<void> {
  const state = readState(ctx.cwd);
  if (state.phase !== "done") {
    if (ctx.hasUI) ctx.ui.notify("Not in done phase. Use /phase next to advance.", "info");
    return;
  }

  await showDoneChecklist(ctx, ctx.cwd);
  if (ctx.hasUI) deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
}

export async function handleLearnCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  if (args.trim()) {
    deps.store.appendLearning(args.trim());
    if (ctx.hasUI) ctx.ui.notify("Learning captured.", "info");
  } else {
    const learning = await ctx.ui.input("What did you learn?");
    if (learning?.trim()) {
      deps.store.appendLearning(learning.trim());
      if (ctx.hasUI) ctx.ui.notify("Learning captured.", "info");
    }
  }
}

export async function handleTddCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim();

  if (sub === "skip") {
    const state = readState(ctx.cwd);
    if (state.phase !== "implement") {
      if (ctx.hasUI) ctx.ui.notify("Not in implement phase.", "info");
      return;
    }
    const tasks = state.activeIssue ? deriveTasks(ctx.cwd, state.activeIssue) : [];
    const currentTask = tasks[state.currentTaskIndex];
    if (!currentTask) {
      if (ctx.hasUI) ctx.ui.notify("No active task to skip TDD for.", "info");
      return;
    }
    const taskIndex = currentTask.index;
    const tddState = state.tddTaskState?.taskIndex === taskIndex
      ? state.tddTaskState
      : { taskIndex, state: "no-test" as const, skipped: false };
    writeState(ctx.cwd, {
      ...state,
      tddTaskState: { ...tddState, skipped: true, skipReason: "User-approved runtime skip" },
    });
    if (ctx.hasUI) {
      ctx.ui.notify("TDD enforcement skipped for current task.", "info");
      deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
    }
    return;
  }

  if (sub === "status") {
    const state = readState(ctx.cwd);
    const tddInfo = state.tddTaskState
      ? `Task ${state.tddTaskState.taskIndex}: ${state.tddTaskState.state}${state.tddTaskState.skipped ? " (skipped)" : ""}`
      : "No active TDD state";
    if (ctx.hasUI) ctx.ui.notify(`TDD Guard: ${tddInfo}\nPhase: ${state.phase ?? "none"}`, "info");
    return;
  }

  if (ctx.hasUI) ctx.ui.notify("Usage: /tdd skip | /tdd status", "info");
}

export async function handleTaskCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim();

  if (sub === "done") {
    const result = handleSignal(ctx.cwd, "task_done", deps.jj);
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) {
        ctx.ui.notify(result.message ?? "Task marked complete.", "info");
        deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
      }
    }
    return;
  }

  if (ctx.hasUI) ctx.ui.notify("Usage: /task done", "info");
}

export async function handleReviewCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim();

  if (sub === "approve") {
    const result = handleSignal(ctx.cwd, "review_approve");
    if (result.error) {
      if (ctx.hasUI) ctx.ui.notify(result.error, "error");
    } else {
      if (ctx.hasUI) ctx.ui.notify(result.message ?? "Review approved.", "info");
    }
    return;
  }

  if (ctx.hasUI) ctx.ui.notify("Usage: /review approve", "info");
}
