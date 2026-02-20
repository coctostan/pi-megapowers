import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createInitialState, getValidTransitions, type MegapowersState, type Phase } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";
import { buildPhasePrompt, buildImplementTaskVars, formatAcceptanceCriteriaList } from "./prompts.js";
import { extractPlanTasks } from "./plan-parser.js";
import { processAgentOutput } from "./artifact-router.js";
import { checkFileWrite, isTestRunnerCommand, handleTestResult, type TddTaskState } from "./tdd-guard.js";
import { shouldCreateTaskChange, createTaskChange, inspectTaskChange, buildTaskCompletionReport } from "./task-coordinator.js";
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

// --- Extension ---

export default function megapowers(pi: ExtensionAPI): void {
  let state: MegapowersState = createInitialState();
  let store: Store;
  let jj: JJ;
  let ui: MegapowersUI;

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    store = createStore(ctx.cwd);
    jj = createJJ(pi);
    ui = createUI();

    // Load persisted state
    state = store.loadState();

    // Also reconstruct from pi session entries (crash recovery)
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && (entry as any).customType === "megapowers-state") {
        try {
          state = (entry as any).data as MegapowersState;
        } catch { /* ignore corrupt entries */ }
      }
    }

    // jj validation
    if (state.activeIssue && state.jjChangeId && await jj.isJJRepo()) {
      const currentId = await jj.getCurrentChangeId();
      if (currentId && currentId !== state.jjChangeId) {
        if (ctx.hasUI) {
          const choice = await ctx.ui.select(
            `jj change mismatch: on ${currentId.slice(0, 8)}, expected ${state.jjChangeId.slice(0, 8)} for ${state.activeIssue}`,
            ["Continue on current change", "Ignore (update stored ID)"]
          );
          if (choice?.startsWith("Ignore")) {
            state = { ...state, jjChangeId: currentId };
            store.saveState(state);
          }
        }
      }
    }

    // Render dashboard
    if (ctx.hasUI) {
      ui.renderDashboard(ctx, state, store);
    }
  });

  pi.on("session_shutdown", async () => {
    if (store) store.saveState(state);
  });

  // --- Prompt injection ---

  pi.on("before_agent_start", async (_event, _ctx) => {
    if (!state.activeIssue || !state.phase) return;

    const vars: Record<string, string> = {
      issue_slug: state.activeIssue,
      phase: state.phase,
    };

    // Load all artifacts for prompt context
    if (store) {
      const artifactMap: Record<string, string> = {
        "brainstorm.md": "brainstorm_content",
        "spec.md": "spec_content",
        "plan.md": "plan_content",
        "diagnosis.md": "diagnosis_content",
        "verify.md": "verify_content",
        "code-review.md": "code_review_content",
      };
      for (const [file, varName] of Object.entries(artifactMap)) {
        const content = store.readPlanFile(state.activeIssue, file);
        if (content) vars[varName] = content;
      }
    }

    // Acceptance criteria formatting
    if (state.acceptanceCriteria.length > 0) {
      vars.acceptance_criteria_list = formatAcceptanceCriteriaList(state.acceptanceCriteria);
    }

    // Implement phase: inject per-task context
    if (state.phase === "implement" && state.planTasks.length > 0) {
      Object.assign(vars, buildImplementTaskVars(state.planTasks, state.currentTaskIndex));
    }

    // Create per-task jj change if needed
    if (state.phase === "implement" && state.planTasks.length > 0 && await jj.isJJRepo()) {
      if (shouldCreateTaskChange(state)) {
        const task = state.planTasks[state.currentTaskIndex];
        const result = await createTaskChange(
          jj,
          state.activeIssue!,
          task.index,
          task.description,
          state.jjChangeId ?? undefined
        );
        if (result.changeId) {
          state = { ...state, taskJJChanges: { ...state.taskJJChanges, [task.index]: result.changeId } };
          store.saveState(state);
        }
      }
    }

    const prompt = buildPhasePrompt(state.phase, vars);
    if (!prompt) return;

    const learnings = store?.getLearnings() ?? "";
    const fullPrompt = learnings
      ? `${prompt}\n\n## Project Learnings\n${learnings}`
      : prompt;

    return {
      message: {
        customType: "megapowers-context",
        content: fullPrompt,
        display: false,
      },
    };
  });

  // --- TDD Guard: intercept file writes ---

  pi.on("tool_call", async (event, _ctx) => {
    if (state.phase !== "implement") return;
    if (state.planTasks.length === 0) return;

    // Only gate write and edit tools
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    const currentTask = state.planTasks[state.currentTaskIndex];
    if (!currentTask) return;

    // Initialize TDD state for current task if needed
    if (!state.tddTaskState || state.tddTaskState.taskIndex !== currentTask.index) {
      state.tddTaskState = {
        taskIndex: currentTask.index,
        state: "no-test",
        skipped: false,
      };
    }

    const result = checkFileWrite(filePath, state.phase, currentTask, state.tddTaskState);

    if (result.newState && state.tddTaskState) {
      state.tddTaskState = { ...state.tddTaskState, state: result.newState };
      if (store) store.saveState(state);
    }

    if (!result.allow) {
      return { block: true, reason: result.reason };
    }
  });

  // --- TDD Guard: detect test runner results ---

  pi.on("tool_result", async (event, _ctx) => {
    if (state.phase !== "implement") return;
    if (event.toolName !== "bash") return;
    if (!state.tddTaskState || state.tddTaskState.state !== "test-written") return;

    const command = (event.input as any)?.command;
    if (!command || !isTestRunnerCommand(command)) return;

    // event.isError is true when bash exits with non-zero code
    const exitCode = event.isError ? 1 : 0;

    const newState = handleTestResult(exitCode, state.tddTaskState.state);
    if (newState !== state.tddTaskState.state) {
      state.tddTaskState = { ...state.tddTaskState, state: newState };
      if (store) store.saveState(state);
    }
  });

  // --- Agent completion: capture artifacts and offer transitions ---

  pi.on("agent_end", async (event, ctx) => {
    const activeIssue = state.activeIssue;
    const phase = state.phase;
    if (!activeIssue || !phase || !store) return;

    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (!lastAssistant) return;
    const text = getAssistantText(lastAssistant);
    if (!text) return;

    // Delegate to tested pure function
    const result = processAgentOutput(text, phase, state);

    // Apply artifacts
    if (result.artifacts.length > 0) {
      store.ensurePlanDir(activeIssue);
      for (const artifact of result.artifacts) {
        store.writePlanFile(activeIssue, artifact.filename, artifact.content);
      }
    }

    // Apply state updates
    if (Object.keys(result.stateUpdate).length > 0) {
      state = { ...state, ...result.stateUpdate };
      store.saveState(state);
    }

    // Send notifications
    if (ctx.hasUI) {
      for (const msg of result.notifications) {
        ctx.ui.notify(msg, "info");
      }
    }

    // Interactive-only: offer phase transition and update dashboard
    if (ctx.hasUI) {
      const validNext = getValidTransitions(state.workflow, phase);
      if (validNext.length > 0) {
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
        pi.appendEntry("megapowers-state", state);
      }

      // Done phase: trigger wrap-up menu
      if (state.phase === "done") {
        state = await ui.handleDonePhase(ctx, state, store, jj);
        store.saveState(state);
        pi.appendEntry("megapowers-state", state);
      }

      ui.renderDashboard(ctx, state, store);
    }
  });

  // --- Commands ---

  pi.registerCommand("mega", {
    description: "Show megapowers dashboard",
    handler: async (_args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      ui = ui ?? createUI();
      ui.renderDashboard(ctx, state, store);
    },
  });

  pi.registerCommand("issue", {
    description: "Create or list issues (usage: /issue new | /issue list)",
    getArgumentCompletions: (prefix) => {
      const subs = ["new", "list"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();
      state = await ui.handleIssueCommand(ctx, state, store, jj, args);
      pi.appendEntry("megapowers-state", state);
    },
  });

  pi.registerCommand("phase", {
    description: "Show current phase or transition (usage: /phase | /phase next)",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();

      if (args.trim() === "next") {
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
        pi.appendEntry("megapowers-state", state);
      } else {
        if (state.phase && state.workflow) {
          ctx.ui.notify(
            `Phase: ${state.phase}\nWorkflow: ${state.workflow}\nIssue: ${state.activeIssue ?? "none"}`,
            "info"
          );
        } else {
          ctx.ui.notify("No active workflow. Use /issue to start.", "info");
        }
      }
    },
  });

  pi.registerCommand("done", {
    description: "Trigger wrap-up menu (when in done phase)",
    handler: async (_args, ctx) => {
      if (state.phase !== "done") {
        ctx.ui.notify("Not in done phase. Use /phase next to advance.", "info");
        return;
      }
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();
      state = await ui.handleDonePhase(ctx, state, store, jj);
      store.saveState(state);
      pi.appendEntry("megapowers-state", state);
      ui.renderDashboard(ctx, state, store);
    },
  });

  pi.registerCommand("learn", {
    description: "Capture a learning",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);

      if (args.trim()) {
        store.appendLearning(args.trim());
        ctx.ui.notify("Learning captured.", "info");
      } else {
        const learning = await ctx.ui.input("What did you learn?");
        if (learning?.trim()) {
          store.appendLearning(learning.trim());
          ctx.ui.notify("Learning captured.", "info");
        }
      }
    },
  });

  pi.registerCommand("tdd", {
    description: "TDD guard control (usage: /tdd skip | /tdd status)",
    getArgumentCompletions: (prefix) => {
      const subs = ["skip", "status"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      const sub = args.trim();

      if (sub === "skip") {
        if (state.phase !== "implement") {
          ctx.ui.notify("Not in implement phase.", "info");
          return;
        }
        // Initialize or reinitialize TDD state for current task
        const currentTask = state.planTasks[state.currentTaskIndex];
        if (!currentTask) {
          ctx.ui.notify("No active task to skip TDD for.", "info");
          return;
        }
        if (!state.tddTaskState || state.tddTaskState.taskIndex !== currentTask.index) {
          state.tddTaskState = {
            taskIndex: currentTask.index,
            state: "no-test",
            skipped: false,
          };
        }
        state.tddTaskState = {
          ...state.tddTaskState,
          skipped: true,
          skipReason: "User-approved runtime skip",
        };
        if (store) store.saveState(state);
        ctx.ui.notify("TDD enforcement skipped for current task.", "info");
        if (ui) ui.renderDashboard(ctx, state, store);
        return;
      }

      if (sub === "status") {
        const tddInfo = state.tddTaskState
          ? `Task ${state.tddTaskState.taskIndex}: ${state.tddTaskState.state}${state.tddTaskState.skipped ? " (skipped)" : ""}`
          : "No active TDD state";
        ctx.ui.notify(`TDD Guard: ${tddInfo}\nPhase: ${state.phase ?? "none"}`, "info");
        return;
      }

      ctx.ui.notify("Usage: /tdd skip | /tdd status", "info");
    },
  });
}
