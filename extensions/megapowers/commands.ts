import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createStore, type Store } from "./state/store.js";
import { createUI, showDoneChecklist, type MegapowersUI } from "./ui.js";
import { readState, writeState } from "./state/state-io.js";
import { handleSignal } from "./tools/tool-signal.js";
import { deriveTasks } from "./state/derived.js";
import { ensureBranch, switchAwayCommit } from "./vcs/branch-manager.js";
import type { ExecGit } from "./vcs/git-ops.js";
import { checkBranchSync } from "./vcs/sync-check.js";
import type { ExecCmd } from "./vcs/pr-creator.js";

export type RuntimeDeps = { store?: Store; ui?: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };

/** Resolved deps — guaranteed non-optional */
export type Deps = { pi: ExtensionAPI; store: Store; ui: MegapowersUI; execGit?: ExecGit; execCmd?: ExecCmd };

/**
 * The ONLY place allowed to create store/ui.
 * Mutates runtimeDeps in-place so hooks and commands always share instances.
 */
export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.ui) rd.ui = createUI();
  return { pi, store: rd.store, ui: rd.ui, execGit: rd.execGit, execCmd: rd.execCmd };
}

// --- Command handlers ---

export async function handleMegaCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim().toLowerCase();

  if (sub === "off") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: false });
    // Hide custom tools from LLM (AC38)
    const activeTools = deps.pi.getActiveTools().filter(
      (t: string) => t !== "megapowers_signal" && t !== "subagent" && t !== "pipeline"
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
    const toolsToAdd = ["megapowers_signal", "subagent", "pipeline"];
    const missing = toolsToAdd.filter((t: string) => !activeTools.includes(t));
    if (missing.length > 0) {
      deps.pi.setActiveTools([...activeTools, ...missing]);
    }
    if (ctx.hasUI) ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
    return;
  }

  deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
}

export async function maybeSwitchAwayFromIssue(
  execGit: ExecGit | undefined,
  previousBranchName: string | null,
): Promise<{ ok: true; committed: boolean } | { ok: false; error: string }> {
  if (!execGit || !previousBranchName) {
    return { ok: true, committed: false };
  }

  const switchResult = await switchAwayCommit(execGit, previousBranchName);
  if ("error" in switchResult) {
    return { ok: false, error: switchResult.error };
  }

  return { ok: true, committed: switchResult.committed };
}

export async function resolveActivationBaseBranch(execGit: ExecGit): Promise<string | null> {
  try {
    const r = await execGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = r.stdout.trim();
    if (currentBranch && /^(feat|fix)\//.test(currentBranch)) {
      await execGit(["checkout", "main"]);
      return "main";
    }
    return currentBranch || null;
  } catch {
    return null;
  }
}

export async function handleIssueCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const prevState = readState(ctx.cwd);
  const newState = await deps.ui.handleIssueCommand(ctx, prevState, deps.store, args);

  // AC14/AC15: VCS branch management on issue activation/switch
  if (deps.execGit && newState.activeIssue && newState.activeIssue !== prevState.activeIssue && newState.workflow) {
    // AC15: WIP commit on previous issue's branch before switching away
    if (prevState.branchName) {
      const switchResult = await maybeSwitchAwayFromIssue(deps.execGit, prevState.branchName);
      if (!switchResult.ok && ctx.hasUI) {
        ctx.ui.notify(`VCS: ${switchResult.error}`, "error");
      }
    }
    // Capture baseBranch for the new issue:
    // - If switching between issues, propagate prevState.baseBranch (e.g. "main") so
    //   the new branch targets the same original base — not the old feature branch.
    // - If fresh activation (no prior branch), capture current HEAD.
    let baseBranch: string | null = null;
    if (prevState.branchName) {
      // Already on a feature branch — preserve the known base
      baseBranch = prevState.baseBranch;
    } else {
      baseBranch = await resolveActivationBaseBranch(deps.execGit);
      // Check if local base is behind remote
      if (baseBranch && deps.execGit) {
        const syncStatus = await checkBranchSync(deps.execGit, baseBranch);
        if (syncStatus.hasRemote && syncStatus.behind > 0 && ctx.hasUI && ctx.ui.select) {
          const choice = await ctx.ui.select(
            `Local \`${baseBranch}\` is ${syncStatus.behind} commit(s) behind remote.`,
            ["Pull latest (recommended)", "Use local as-is"],
          );
          if (choice === "Pull latest (recommended)") {
            try {
              await deps.execGit(["pull"]);
            } catch (err: any) {
              if (ctx.hasUI) ctx.ui.notify(`VCS: git pull failed: ${err?.message}`, "error");
            }
          }
        }
      }
    }
    const result = await ensureBranch(deps.execGit, newState.activeIssue, newState.workflow);
    if ("branchName" in result) {
      newState.branchName = result.branchName;
      newState.baseBranch = baseBranch;
    } else {
      // AC16: surface error, don't block activation
      if (ctx.hasUI) ctx.ui.notify(`VCS: ${result.error}`, "error");
    }
  }
  writeState(ctx.cwd, newState);
}

export async function handleTriageCommand(_args: string, ctx: any, deps: Deps): Promise<void> {
  const state = readState(ctx.cwd);
  const newState = await deps.ui.handleTriageCommand(ctx, state, deps.store);
  writeState(ctx.cwd, newState);
}

export async function handlePhaseCommand(args: string, ctx: any, deps: Deps): Promise<void> {
  const sub = args.trim().toLowerCase();

  if (sub === "next" || (sub !== "" && sub !== "status")) {
    // "next" uses default forward transition; any other non-empty string is a target phase
    const target = sub === "next" ? undefined : sub;
    const result = handleSignal(ctx.cwd, "phase_next", target);
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
    const result = handleSignal(ctx.cwd, "task_done");
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
