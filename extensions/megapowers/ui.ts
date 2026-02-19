import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MegapowersState, Phase, WorkflowType } from "./state-machine.js";
import type { Issue, Store } from "./store.js";
import type { JJ } from "./jj.js";
import { createInitialState, getFirstPhase, getValidTransitions, transition } from "./state-machine.js";
import { formatChangeDescription } from "./jj.js";
import { checkGate } from "./gates.js";

// --- Theme type (subset used by pure renderers) ---

interface ThemeLike {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

// --- Phase labels ---

const FEATURE_PHASES: Phase[] = ["brainstorm", "spec", "plan", "review", "implement", "verify", "code-review", "done"];
const BUGFIX_PHASES: Phase[] = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"];

function getPhasesForWorkflow(workflow: WorkflowType): Phase[] {
  return workflow === "feature" ? FEATURE_PHASES : BUGFIX_PHASES;
}

// --- Pure rendering (testable) ---

export function formatPhaseProgress(workflow: WorkflowType, currentPhase: Phase, theme: ThemeLike): string {
  const phases = getPhasesForWorkflow(workflow);
  return phases
    .map((p) => {
      if (p === currentPhase) return theme.bold(`▶${p}`);
      const idx = phases.indexOf(p);
      const currentIdx = phases.indexOf(currentPhase);
      if (idx < currentIdx) return theme.fg("success", p);
      return theme.fg("dim", p);
    })
    .join(theme.fg("dim", " → "));
}

export function renderStatusText(state: MegapowersState): string {
  if (!state.activeIssue) return "";
  const idNum = state.activeIssue.match(/^(\d+)/)?.[1] ?? "?";
  const completed = state.planTasks.filter((t) => t.completed).length;
  const total = state.planTasks.length;
  const taskInfo = total > 0 ? ` ${completed}/${total}` : "";
  return `📋 #${idNum} ${state.phase ?? "?"}${taskInfo}`;
}

export function renderDashboardLines(state: MegapowersState, _issues: Issue[], theme: ThemeLike): string[] {
  const lines: string[] = [];

  if (!state.activeIssue) {
    lines.push(theme.fg("dim", "No active issue."));
    lines.push(`${theme.fg("accent", "/issue new")}  — create an issue`);
    lines.push(`${theme.fg("accent", "/issue list")} — pick an issue to work on`);
    return lines;
  }

  const workflowLabel = state.workflow ? `[${state.workflow}]` : "";
  lines.push(
    `${theme.fg("accent", "Issue:")} ${theme.bold(`#${state.activeIssue}`)} ${theme.fg("dim", workflowLabel)}`
  );

  if (state.phase && state.workflow) {
    lines.push(`${theme.fg("accent", "Phase:")} ${formatPhaseProgress(state.workflow, state.phase, theme)}`);
  }

  // Task progress (implement phase or whenever tasks exist)
  if (state.planTasks.length > 0) {
    const completed = state.planTasks.filter((t) => t.completed).length;
    lines.push(`${theme.fg("accent", "Tasks:")} ${completed}/${state.planTasks.length} complete`);

    // Show current task in implement phase
    if (state.phase === "implement" && state.currentTaskIndex < state.planTasks.length) {
      const current = state.planTasks[state.currentTaskIndex];
      lines.push(`${theme.fg("accent", "Current:")} Task ${current.index}: ${current.description}`);
    }

    // TDD guard state indicator (implement phase only)
    if (state.phase === "implement") {
      const currentTask = state.planTasks[state.currentTaskIndex];
      let tddIndicator: string;

      if (currentTask?.noTest || state.tddTaskState?.skipped) {
        tddIndicator = "⚪ Skipped";
      } else if (!state.tddTaskState || state.tddTaskState.state === "no-test") {
        tddIndicator = "🔴 Need test";
      } else if (state.tddTaskState.state === "test-written") {
        tddIndicator = "🟡 Run test";
      } else if (state.tddTaskState.state === "impl-allowed") {
        tddIndicator = "🟢 Implement";
      } else {
        tddIndicator = "—";
      }

      lines.push(`${theme.fg("accent", "TDD:")} ${tddIndicator}`);
    }
  }

  // Acceptance criteria status (verify and code-review phases)
  if (state.acceptanceCriteria.length > 0 && (state.phase === "verify" || state.phase === "code-review")) {
    const passed = state.acceptanceCriteria.filter(c => c.status === "pass").length;
    lines.push(`${theme.fg("accent", "Criteria:")} ${passed}/${state.acceptanceCriteria.length} passing`);
  }

  if (state.jjChangeId) {
    lines.push(`${theme.fg("accent", "jj:")} ${theme.fg("dim", state.jjChangeId)}`);
  }

  return lines;
}

export function formatIssueListItem(issue: Issue): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  return `${id} ${issue.title} [${issue.type}] [${issue.status}]`;
}

// --- Interactive UI (uses ctx.ui) ---

export interface MegapowersUI {
  renderDashboard(ctx: ExtensionContext, state: MegapowersState, store: Store): void;
  updateStatus(ctx: ExtensionContext, state: MegapowersState): void;

  handleIssueCommand(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ,
    args: string
  ): Promise<MegapowersState>;

  handlePhaseTransition(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ
  ): Promise<MegapowersState>;

  handleDonePhase(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ
  ): Promise<MegapowersState>;
}

export function createUI(): MegapowersUI {
  return {
    renderDashboard(ctx, state, store) {
      const issues = store.listIssues();
      const lines = renderDashboardLines(state, issues, ctx.ui.theme);
      ctx.ui.setWidget("megapowers", lines);
      this.updateStatus(ctx, state);
    },

    updateStatus(ctx, state) {
      const text = renderStatusText(state);
      if (text) {
        ctx.ui.setStatus("megapowers", ctx.ui.theme.fg("accent", text));
      } else {
        ctx.ui.setStatus("megapowers", undefined);
      }
    },

    async handleIssueCommand(ctx, state, store, jj, args) {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || "list";

      if (subcommand === "new" || subcommand === "create") {
        const title = await ctx.ui.input("Issue title:");
        if (!title) return state;

        const typeChoice = await ctx.ui.select("Issue type:", ["feature", "bugfix"]);
        if (!typeChoice) return state;
        const type = typeChoice as "feature" | "bugfix";

        const description = await ctx.ui.editor("Description:", "") ?? "";
        const issue = store.createIssue(title, type, description);

        // Activate the issue
        const firstPhase = getFirstPhase(type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: issue.slug,
          workflow: type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          planTasks: [],
          jjChangeId: null,
          acceptanceCriteria: [],
          currentTaskIndex: 0,
        };

        // Create jj change if in a jj repo
        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(issue.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

        store.saveState(newState);
        store.updateIssueStatus(issue.slug, "in-progress");
        ctx.ui.notify(`Created and activated: ${issue.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      if (subcommand === "list") {
        const issues = store.listIssues();
        if (issues.length === 0) {
          ctx.ui.notify("No issues. Use /issue new to create one.", "info");
          return state;
        }

        const items = issues.map(formatIssueListItem);
        items.push("+ Create new issue...");

        const choice = await ctx.ui.select("Pick an issue:", items);
        if (!choice) return state;

        if (choice.startsWith("+")) {
          return this.handleIssueCommand(ctx, state, store, jj, "new");
        }

        // Parse slug from selection
        const idMatch = choice.match(/^#(\d+)/);
        if (!idMatch) return state;
        const selected = issues.find((i) => i.id === parseInt(idMatch[1]));
        if (!selected) return state;

        // Activate the issue
        const firstPhase = getFirstPhase(selected.type);
        const newState: MegapowersState = {
          ...state,
          activeIssue: selected.slug,
          workflow: selected.type,
          phase: firstPhase,
          phaseHistory: [],
          reviewApproved: false,
          planTasks: [],
          jjChangeId: null,
          acceptanceCriteria: [],
          currentTaskIndex: 0,
        };

        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(selected.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

        store.saveState(newState);
        store.updateIssueStatus(selected.slug, "in-progress");
        ctx.ui.notify(`Activated: ${selected.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: new, list`, "error");
      return state;
    },

    async handleDonePhase(ctx, state, store, jj) {
      if (!state.activeIssue) return state;

      const actions = [
        "Close issue",
        "Generate commit message",
        "Update docs (LLM generates from artifacts)",
        "Write changelog entry",
        "Done — finish without further actions",
      ];

      let continueMenu = true;
      let newState = state;

      while (continueMenu) {
        const choice = await ctx.ui.select("Wrap-up actions:", actions);
        if (!choice || choice.startsWith("Done")) {
          continueMenu = false;
          break;
        }

        if (choice === "Close issue") {
          store.updateIssueStatus(state.activeIssue, "done");
          newState = createInitialState();
          store.saveState(newState);
          ctx.ui.notify("Issue closed.", "info");
          continueMenu = false;
          break;
        }

        if (choice.startsWith("Generate commit")) {
          ctx.ui.notify("Ask the LLM to generate a commit message based on the spec and changes.", "info");
        }

        if (choice.startsWith("Update docs")) {
          ctx.ui.notify("Ask the LLM to generate/update docs. The done-phase prompt will guide it.", "info");
        }

        if (choice.startsWith("Write changelog")) {
          ctx.ui.notify("Ask the LLM to write a changelog entry. The done-phase prompt will guide it.", "info");
        }
      }

      return newState;
    },

    async handlePhaseTransition(ctx, state, store, jj) {
      if (!state.workflow || !state.phase || !state.activeIssue) return state;

      const validNext = getValidTransitions(state.workflow, state.phase);
      if (validNext.length === 0) {
        ctx.ui.notify("No valid transitions from current phase.", "info");
        return state;
      }

      // Check gates for each valid transition and annotate
      const options: { phase: Phase; label: string; gated: boolean; reason?: string }[] = [];
      for (const p of validNext) {
        const gate = checkGate(state, p, store);
        let label = p as string;
        if (
          (state.phase === "review" && p === "plan") ||
          (state.phase === "verify" && p === "implement") ||
          (state.phase === "code-review" && p === "implement")
        ) {
          label = `← ${p} (go back)`;
        }
        if (p === "implement" && state.phase === "plan") {
          label = `${p} (skip review)`;
        }
        if (!gate.pass) {
          label = `${label} ⛔ ${gate.reason}`;
        }
        options.push({ phase: p, label, gated: !gate.pass, reason: gate.reason });
      }

      const labels = options.map(o => o.label);
      const choice = await ctx.ui.select(`Phase "${state.phase}" — what next?`, labels);
      if (!choice) return state;

      const selected = options.find(o => o.label === choice);
      if (!selected) return state;

      if (selected.gated) {
        ctx.ui.notify(`Cannot advance: ${selected.reason}`, "error");
        return state;
      }

      const targetPhase = selected.phase;
      let newState = transition(state, targetPhase);

      // jj: describe current, create new change
      if (await jj.isJJRepo()) {
        await jj.describe(formatChangeDescription(state.activeIssue, state.phase!, "complete"));
        const changeId = await jj.newChange(formatChangeDescription(state.activeIssue, targetPhase));
        if (changeId) newState = { ...newState, jjChangeId: changeId };
      }

      store.saveState(newState);
      ctx.ui.notify(`Transitioned to: ${targetPhase}`, "info");
      this.renderDashboard(ctx, newState, store);
      return newState;
    },
  };
}
