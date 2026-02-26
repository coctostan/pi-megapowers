import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { MegapowersState, Phase, PlanTask, WorkflowType } from "./state/state-machine.js";
import type { Issue, Store } from "./state/store.js";
import type { JJ } from "./jj.js";
import { createInitialState, getFirstPhase, getValidTransitions, transition } from "./state/state-machine.js";
import { formatChangeDescription } from "./jj.js";
import { checkGate } from "./policy/gates.js";
import { writeState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";

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

export const DONE_MODE_LABELS: Record<string, string> = {
  "generate-docs": "Generate docs",
  "generate-bugfix-summary": "Bugfix summary",
  "write-changelog": "Write changelog",
  "capture-learnings": "Capture learnings",
};

export function renderStatusText(state: MegapowersState, tasks?: PlanTask[]): string {
  if (!state.activeIssue) return "";
  const idNum = state.activeIssue.match(/^(\d+)/)?.[1] ?? "?";
  const total = tasks?.length ?? 0;
  const completedSet = new Set(state.completedTasks);
  const completed = tasks?.filter(t => completedSet.has(t.index)).length ?? 0;
  const taskInfo = total > 0 ? ` ${completed}/${total}` : "";
  const modeLabel = state.doneMode ? ` → ${DONE_MODE_LABELS[state.doneMode] ?? state.doneMode}` : "";
  return `📋 #${idNum} ${state.phase ?? "?"}${taskInfo}${modeLabel}`;
}

export function renderDashboardLines(state: MegapowersState, _issues: Issue[], theme: ThemeLike, tasks?: PlanTask[]): string[] {
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

  // Done phase: show active mode and instruction
  if (state.phase === "done" && state.doneMode) {
    const label = DONE_MODE_LABELS[state.doneMode] ?? state.doneMode;
    lines.push(`${theme.fg("accent", "Action:")} ${label}`);
    lines.push(theme.fg("dim", "Send any message to generate."));
  }

  if (state.jjChangeId) {
    lines.push(`${theme.fg("accent", "jj:")} ${theme.fg("dim", state.jjChangeId)}`);
  }

  return lines;
}

export function formatIssueListItem(issue: Issue, batchSlug?: string | null): string {
  const id = `#${String(issue.id).padStart(3, "0")}`;
  const batchAnnotation = batchSlug ? ` (in batch ${batchSlug})` : "";
  return `${id} ${issue.title} [${issue.type}] [${issue.status}]${batchAnnotation}`;
}

function closeSourceIssues(activeIssue: string, store: Store): void {
  const issue = store.getIssue(activeIssue);
  if (issue && issue.sources.length > 0) {
    const sourceIssues = store.getSourceIssues(activeIssue);
    for (const src of sourceIssues) {
      store.updateIssueStatus(src.slug, "done");
    }
  }
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

  handleTriageCommand(
    ctx: ExtensionContext,
    state: MegapowersState,
    store: Store,
    jj: JJ,
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
          jjChangeId: null,
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          taskJJChanges: {},
          doneMode: null,
        };

        // Create jj change if in a jj repo
        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(issue.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

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
          jjChangeId: null,
          currentTaskIndex: 0,
          completedTasks: [],
          tddTaskState: null,
          taskJJChanges: {},
          doneMode: null,
        };

        if (await jj.isJJRepo()) {
          const desc = formatChangeDescription(selected.slug, firstPhase);
          const changeId = await jj.newChange(desc, "main");
          if (changeId) newState.jjChangeId = changeId;
        }

        writeState(ctx.cwd, newState);
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

      const isBugfix = state.workflow === "bugfix";
      const actions = isBugfix
        ? [
            "Generate bugfix summary",
            "Write changelog entry",
            "Capture learnings",
            "Close issue",
          ]
        : [
            "Generate feature doc",
            "Write changelog entry",
            "Capture learnings",
            "Close issue",
          ];

      // Offer squash if there are per-task jj changes and a phase change to squash into
      const hasTaskChanges = Object.keys(state.taskJJChanges).length > 0 && state.jjChangeId;
      if (hasTaskChanges) {
        actions.push("Squash task changes into phase change");
      }

      actions.push("Done — finish without further actions");

      let continueMenu = true;
      let newState = state;

      while (continueMenu) {
        const choice = await ctx.ui.select("Wrap-up actions:", actions);
        if (!choice) {
          // Dismissed — leave state unchanged, stay in done phase
          continueMenu = false;
          break;
        }
        if (choice.startsWith("Done")) {
          // Explicitly chose to finish — close the issue and reset state
          closeSourceIssues(state.activeIssue, store);
          store.updateIssueStatus(state.activeIssue, "done");
          newState = createInitialState();
          writeState(ctx.cwd, newState);
          ctx.ui.notify("Issue closed.", "info");
          continueMenu = false;
          break;
        }

        if (choice === "Generate feature doc") {
          newState = { ...newState, doneMode: "generate-docs" };
          ctx.ui.notify(
            "Feature doc mode active. Send any message to the LLM to generate the feature doc.\nThe doc will be saved to .megapowers/docs/.",
            "info"
          );
          continueMenu = false;
          break;
        }

        if (choice === "Generate bugfix summary") {
          newState = { ...newState, doneMode: "generate-bugfix-summary" };
          ctx.ui.notify(
            "Bugfix summary mode active. Send any message to the LLM to generate the bugfix summary.\nThe summary will be saved to .megapowers/docs/.",
            "info"
          );
          continueMenu = false;
          break;
        }

        if (choice === "Write changelog entry") {
          newState = { ...newState, doneMode: "write-changelog" };
          ctx.ui.notify(
            "Changelog mode active. Send any message to the LLM to generate the changelog entry.\nThe entry will be appended to .megapowers/CHANGELOG.md.",
            "info"
          );
          continueMenu = false;
          break;
        }

        if (choice === "Capture learnings") {
          newState = { ...newState, doneMode: "capture-learnings" };
          ctx.ui.notify(
            "Learnings capture mode active. Send any message to the LLM to generate learning suggestions.\nReview the output and use /learn to save individual entries.",
            "info"
          );
          continueMenu = false;
          break;
        }

        if (choice === "Close issue") {
          closeSourceIssues(state.activeIssue, store);
          store.updateIssueStatus(state.activeIssue, "done");
          newState = createInitialState();
          writeState(ctx.cwd, newState);
          ctx.ui.notify("Issue closed.", "info");
          continueMenu = false;
          break;
        }

        if (choice === "Squash task changes into phase change") {
          if (state.jjChangeId) {
            await jj.squashInto(state.jjChangeId);
            newState = { ...newState, taskJJChanges: {} };
            ctx.ui.notify("Task changes squashed into phase change.", "info");
          }
          // Continue menu after squash
          continue;
        }

        // Catch-all: unknown selection exits the loop (prevents hang)
        break;
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
        const gate = checkGate(state, p, store, ctx.cwd);
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

      writeState(ctx.cwd, newState);
      const guidance = PHASE_GUIDANCE[targetPhase] ?? "";
      ctx.ui.notify(`Transitioned to: ${targetPhase}. ${guidance}`, "info");
      this.renderDashboard(ctx, newState, store);
      return newState;
    },

    async handleTriageCommand(ctx, state, store, jj) {
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
        jjChangeId: null,
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null,
        taskJJChanges: {},
        doneMode: null,
      };

      if (await jj.isJJRepo()) {
        const desc = formatChangeDescription(issue.slug, firstPhase);
        const changeId = await jj.newChange(desc, "main");
        if (changeId) newState.jjChangeId = changeId;
      }

      writeState(ctx.cwd, newState);
      store.updateIssueStatus(issue.slug, "in-progress");
      ctx.ui.notify(`Created batch: ${issue.slug} (sources: ${sources.join(", ")})`, "info");
      this.renderDashboard(ctx, newState, store);
      return newState;
    },
  };
}
