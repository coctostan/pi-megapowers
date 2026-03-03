import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MegapowersState, Phase, PlanTask, WorkflowType } from "./state/state-machine.js";
import type { Issue, Store } from "./state/store.js";
import { getFirstPhase } from "./state/state-machine.js";
import { readState, writeState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { showChecklistUI } from "./ui-checklist.js";

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

export const PHASE_GUIDANCE: Record<string, string> = {
  brainstorm: "Send a message to brainstorm your idea.",
  spec: "Send a message to write the spec.",
  plan: "Send a message to generate the plan.",
  review: "Send a message to review the plan.",
  reproduce: "Send a message to reproduce the bug.",
  diagnose: "Send a message to diagnose the root cause.",
  verify: "Send a message to verify the implementation.",
  "code-review": "Send a message to review the code.",
};


export interface DoneChecklistItem {
  key: string;
  label: string;
  defaultChecked: boolean;
}

export function getDoneChecklistItems(state: MegapowersState): DoneChecklistItem[] {
  const isBugfix = state.workflow === "bugfix";
  const items: DoneChecklistItem[] = [];

  if (isBugfix) {
    items.push({ key: "generate-bugfix-summary", label: "Generate bugfix summary", defaultChecked: true });
  } else {
    items.push({ key: "generate-docs", label: "Generate feature document", defaultChecked: true });
  }

  items.push({ key: "write-changelog", label: "Write changelog entry", defaultChecked: true });
  items.push({ key: "capture-learnings", label: "Capture learnings", defaultChecked: true });

  items.push({ key: "push-and-pr", label: "Push & create PR", defaultChecked: true });
  items.push({ key: "close-issue", label: "Close issue", defaultChecked: true });

  return items;
}


export async function showDoneChecklist(ctx: any, cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state.activeIssue || state.phase !== "done") return;
  if (!ctx.hasUI) {
    // Headless: auto-select all default-checked items (#081 fix)
    const doneActions = getDoneChecklistItems(state)
      .filter(i => i.defaultChecked)
      .map(i => i.key);
    writeState(cwd, { ...readState(cwd), doneActions });
    return;
  }
  const checklistItems = getDoneChecklistItems(state);
  const selectedKeys = await showChecklistUI(
    ctx,
    checklistItems.map((i) => ({ key: i.key, label: i.label, checked: i.defaultChecked })),
    "Done — select wrap-up actions to perform:",
  );
  // null = dismissed (Escape) → store empty array
  const doneActions = selectedKeys ?? [];
  writeState(cwd, { ...readState(cwd), doneActions });
}



export function renderStatusText(state: MegapowersState, tasks?: PlanTask[]): string {
  if (!state.activeIssue) return "";
  const idNum = state.activeIssue.match(/^(\d+)/)?.[1] ?? "?";
  const total = tasks?.length ?? 0;
  const completedSet = new Set(state.completedTasks);
  const completed = tasks?.filter(t => completedSet.has(t.index)).length ?? 0;
  const taskInfo = total > 0 ? ` ${completed}/${total}` : "";
  const modeLabel = state.doneActions.length > 0 ? ` → ${state.doneActions.length} actions` : "";
  return `📋 #${idNum} ${state.phase ?? "?"}${taskInfo}${modeLabel}`;
}

export function renderDashboardLines(state: MegapowersState, _issues: Issue[], theme: ThemeLike, tasks?: PlanTask[]): string[] {
  const lines: string[] = [];

  if (!state.activeIssue) {
    lines.push(theme.fg("dim", "No active issue."));
    lines.push(`${theme.fg("accent", "/issue new")}  — create an issue`);
    lines.push(`${theme.fg("accent", "/issue list")} — pick an issue to work on`);
    lines.push(`${theme.fg("accent", "/triage")}     — batch and prioritize issues`);
    lines.push(`${theme.fg("accent", "/mega on|off")} — enable/disable workflow enforcement`);
    lines.push(theme.fg("dim", "See ROADMAP.md and .megapowers/milestones.md for what's next."));
    return lines;
  }

  const workflowLabel = state.workflow ? `[${state.workflow}]` : "";
  lines.push(
    `${theme.fg("accent", "Issue:")} ${theme.bold(`#${state.activeIssue}`)} ${theme.fg("dim", workflowLabel)}`
  );

  if (state.phase && state.workflow) {
    lines.push(`${theme.fg("accent", "Phase:")} ${formatPhaseProgress(state.workflow, state.phase, theme)}`);
  }

  const taskList = tasks ?? [];
  const completedSet = new Set(state.completedTasks);

  // Phase guidance — show for phases without their own detailed content
  if (state.phase && state.phase !== "done" && state.phase !== "implement" && taskList.length === 0) {
    const guidance = PHASE_GUIDANCE[state.phase];
    if (guidance) {
      lines.push(theme.fg("dim", guidance));
    }
  }

  // Task progress (implement phase or whenever tasks exist)
  if (taskList.length > 0) {
    const completed = taskList.filter(t => completedSet.has(t.index)).length;
    lines.push(`${theme.fg("accent", "Tasks:")} ${completed}/${taskList.length} complete`);

    // Show current task in implement phase
    if (state.phase === "implement" && state.currentTaskIndex < taskList.length) {
      const current = taskList[state.currentTaskIndex];
      lines.push(`${theme.fg("accent", "Current:")} Task ${current.index}: ${current.description}`);
    }

    // TDD guard state indicator (implement phase only)
    if (state.phase === "implement") {
      const currentTask = taskList[state.currentTaskIndex];
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

  // Done phase: show active actions and instruction
  if (state.phase === "done" && state.doneActions.length > 0) {
    const label = state.doneActions.join(", ");
    lines.push(`${theme.fg("accent", "Actions:")} ${label}`);
    lines.push(theme.fg("dim", "Send any message to execute wrap-up actions."));
  }

  return lines;
}

export function formatIssueListItem(issue: Issue, batchSlug?: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const batchAnnotation = batchSlug ? ` (in batch ${batchSlug})` : "";
  return `${id} ${issue.title} [${issue.type}] [${issue.status}]${batchAnnotation}`;
}


// --- Triage helpers (pure functions) ---

export function filterTriageableIssues(issues: Issue[]): Issue[] {
  return issues.filter(i => i.status !== "done" && i.sources.length === 0);
}

export function formatTriageIssueList(issues: Issue[]): string {
  return issues
    .map(i => `- #${String(i.id).padStart(3, "0")} ${i.title} [${i.type}] — ${i.description.slice(0, 120)}`)
    .join("\n");
}

// --- Interactive UI (uses ctx.ui) ---

export interface MegapowersUI {
  renderDashboard(ctx: ExtensionContext, state: MegapowersState, store: Store): void;
  updateStatus(ctx: ExtensionContext, state: MegapowersState, tasks?: PlanTask[]): void;

  handleIssueCommand(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    args: string
  ): Promise<MegapowersState>;


  handleTriageCommand(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
  ): Promise<MegapowersState>;
}

export function createUI(): MegapowersUI {
  return {
    renderDashboard(ctx, state, store) {
      const issues = store.listIssues();
      const tasks = state.activeIssue ? deriveTasks(ctx.cwd, state.activeIssue) : [];
      const lines = renderDashboardLines(state, issues, ctx.ui.theme, tasks);
      ctx.ui.setWidget("megapowers", lines);
      this.updateStatus(ctx, state, tasks);
    },

    updateStatus(ctx, state, tasks?) {
      const text = renderStatusText(state, tasks);
      if (text) {
        ctx.ui.setStatus("megapowers", ctx.ui.theme.fg("accent", text));
      } else {
        ctx.ui.setStatus("megapowers", undefined);
      }
    },

    async handleIssueCommand(ctx, state, store, args) {
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
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          doneActions: [],
        };

        writeState(ctx.cwd, newState);
        store.updateIssueStatus(issue.slug, "in-progress");
        ctx.ui.notify(`Created and activated: ${issue.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      if (subcommand === "list") {
        const issues = store.listIssues().filter(i => i.status !== "done");
        if (issues.length === 0) {
          ctx.ui.notify("No open issues. Use /issue new to create one.", "info");
          return state;
        }

        const items = issues.map(i => formatIssueListItem(i, store.getBatchForIssue(i.id)));
        items.push("+ Create new issue...");

        const choice = await ctx.ui.select("Pick an issue:", items);
        if (!choice) return state;

        if (choice.startsWith("+")) {
          return this.handleIssueCommand(ctx, state, store, "new");
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
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          doneActions: [],
        };

        writeState(ctx.cwd, newState);
        store.updateIssueStatus(selected.slug, "in-progress");
        ctx.ui.notify(`Activated: ${selected.slug}`, "info");
        this.renderDashboard(ctx, newState, store);
        return newState;
      }

      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: new, list`, "error");
      return state;
    },



    async handleTriageCommand(ctx, state, store) {
      const allIssues = store.listIssues();
      const openIssues = allIssues.filter(i => i.status !== "done" && i.sources.length === 0);

      if (openIssues.length === 0) {
        ctx.ui.notify("No open issues to triage.", "info");
        return state;
      }

      // Display open issues
      const issueList = openIssues
        .map(i => `- #${String(i.id).padStart(3, "0")} ${i.title} [${i.type}] — ${i.description.slice(0, 80)}`)
        .join("\n");
      ctx.ui.notify(`Open issues:\n${issueList}`, "info");

      // Get batch parameters from user
      const title = await ctx.ui.input("Batch title:");
      if (!title) return state;

      const typeChoice = await ctx.ui.select("Batch type:", ["bugfix", "feature"]);
      if (!typeChoice) return state;
      const type = typeChoice as "feature" | "bugfix";

      const sourceInput = await ctx.ui.input("Source issue IDs (comma-separated, e.g. 1, 3, 5):");
      if (!sourceInput) return state;

      const sources = sourceInput.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (sources.length === 0) {
        ctx.ui.notify("No valid source IDs provided.", "error");
        return state;
      }

      const description = await ctx.ui.editor("Batch description:", "") ?? "";

      // Create the batch issue
      const issue = store.createIssue(title, type, description, sources);

      // Activate it
      const firstPhase = getFirstPhase(type);
      const newState: MegapowersState = {
        ...state,
        activeIssue: issue.slug,
        workflow: type,
        phase: firstPhase,
        phaseHistory: [],
        reviewApproved: false,
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
        doneActions: [],
      };

      writeState(ctx.cwd, newState);
      store.updateIssueStatus(issue.slug, "in-progress");
      ctx.ui.notify(`Created batch: ${issue.slug} (sources: ${sources.join(", ")})`, "info");
      this.renderDashboard(ctx, newState, store);
      return newState;
    },
  };
}
