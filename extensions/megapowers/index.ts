import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createInitialState, getValidTransitions, OPEN_ENDED_PHASES, type MegapowersState, type Phase } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";
import { buildImplementTaskVars, formatAcceptanceCriteriaList, loadPromptFile, BRAINSTORM_PLAN_PHASES, interpolatePrompt, getPhasePromptTemplate, allTasksComplete } from "./prompts.js";
import { extractPlanTasks } from "./plan-parser.js";
import { processAgentOutput } from "./artifact-router.js";
import { resolveStartupState } from "./state-recovery.js";
import { checkFileWrite, isTestRunnerCommand, handleTestResult, type TddTaskState } from "./tdd-guard.js";
import { createSatelliteTddState, handleSatelliteToolCall } from "./satellite-tdd.js";
import { shouldCreateTaskChange, createTaskChange, inspectTaskChange, buildTaskCompletionReport } from "./task-coordinator.js";
import { isSatelliteMode, loadSatelliteState } from "./satellite.js";
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
  // --- Satellite mode: TDD-only for subagent sessions ---
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    let satelliteState: Readonly<MegapowersState> | null = null;
    let satelliteTddState: TddTaskState | null = null;

    pi.on("session_start", async (_event, ctx) => {
      satelliteState = loadSatelliteState(ctx.cwd);
      satelliteTddState = satelliteState ? createSatelliteTddState(satelliteState) : null;
    });

    pi.on("tool_call", async (event, _ctx) => {
      if (!satelliteState || !satelliteTddState) return;

      const filePath: string | undefined = (event.input as any)?.path;
      const result = handleSatelliteToolCall(event.toolName, filePath, satelliteState, satelliteTddState);

      if (result && result.block) {
        return { block: true, reason: result.reason };
      }
    });

    pi.on("tool_result", async (event, _ctx) => {
      if (!satelliteTddState) return;
      if (satelliteTddState.state !== "test-written") return;
      if (event.toolName !== "bash") return;

      const command = (event.input as any)?.command;
      if (!command || !isTestRunnerCommand(command)) return;

      const exitCode = event.isError ? 1 : 0;
      const newState = handleTestResult(exitCode, satelliteTddState.state);
      if (newState !== satelliteTddState.state) {
        satelliteTddState.state = newState;
      }
    });

    return; // Skip all primary session setup
  }

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
    const fileState = store.loadState();

    // Collect session entry states for crash recovery
    const sessionEntryStates: MegapowersState[] = [];
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && (entry as any).customType === "megapowers-state") {
        try {
          sessionEntryStates.push((entry as any).data as MegapowersState);
        } catch { /* ignore corrupt entries */ }
      }
    }

    // state.json is authoritative; session entries only for crash recovery
    state = resolveStartupState(fileState, sessionEntryStates);

    // Recovery: if in implement phase with empty planTasks, re-parse from plan.md
    if (state.activeIssue && state.phase === "implement" && state.planTasks.length === 0) {
      const planContent = store.readPlanFile(state.activeIssue, "plan.md");
      if (planContent) {
        const tasks = extractPlanTasks(planContent);
        if (tasks.length > 0) {
          state = {
            ...state,
            planTasks: tasks,
            currentTaskIndex: tasks.findIndex(t => !t.completed),
          };
          if (state.currentTaskIndex === -1) state.currentTaskIndex = 0;
          store.saveState(state);
        }
      }
    }

    // Auto-advance: if in implement phase and all tasks are done, offer verify transition
    if (state.activeIssue && state.phase === "implement" && state.planTasks.length > 0) {
      const allDone = state.planTasks.every(t => t.completed);
      if (allDone && ctx.hasUI) {
        ctx.ui.notify("All implementation tasks complete. Ready to advance to verify.", "info");
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
        pi.appendEntry("megapowers-state", state);
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
    if (store) {
      // Check if the file has been updated externally (e.g. by another session or manual edit)
      // Only save if our in-memory state is at least as advanced as the file state
      const fileState = store.loadState();

      // If the file state has been reset (no active issue), don't overwrite with stale in-memory state
      if (!fileState.activeIssue && state.activeIssue) return;

      // If the file state switched to a different issue, don't overwrite
      if (fileState.activeIssue && state.activeIssue && fileState.activeIssue !== state.activeIssue) return;

      const phaseOrder = ["brainstorm", "spec", "reproduce", "diagnose", "plan", "review", "implement", "verify", "code-review", "done"];
      const filePhaseIdx = phaseOrder.indexOf(fileState.phase);
      const memPhaseIdx = phaseOrder.indexOf(state.phase);
      // If file is ahead of in-memory, don't overwrite
      if (filePhaseIdx > memPhaseIdx) return;

      // If both are in the same phase, protect planTasks from being overwritten with stale/empty data.
      // The file state with more completed tasks is more advanced.
      if (filePhaseIdx === memPhaseIdx && fileState.phase === "implement") {
        const fileCompleted = fileState.planTasks.filter(t => t.completed).length;
        const memCompleted = state.planTasks.filter(t => t.completed).length;
        // Don't overwrite if file has more completed tasks, or file has tasks and memory doesn't
        if (fileState.planTasks.length > 0 && state.planTasks.length === 0) return;
        if (fileCompleted > memCompleted) return;
      }

      store.saveState(state);
    }
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

      // Bugfix mode: alias reproduce/diagnosis to brainstorm/spec variables
      // so shared templates (write-plan.md, etc.) get bugfix context
      if (state.workflow === "bugfix") {
        const reproduce = store.readPlanFile(state.activeIssue, "reproduce.md");
        const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
        if (reproduce) {
          vars.brainstorm_content = reproduce;
          vars.reproduce_content = reproduce;
        }
        if (diagnosis) {
          vars.spec_content = diagnosis;
          vars.diagnosis_content = diagnosis;
        }
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


    // Learnings + Roadmap: brainstorm and plan phases only
    if (BRAINSTORM_PLAN_PHASES.includes(state.phase)) {
      vars.learnings = store?.getLearnings() ?? "";
      vars.roadmap = store?.readRoadmap() ?? "";
    }

    // Select prompt template (done phase requires doneMode)
    let template = state.phase === "done" ? "" : getPhasePromptTemplate(state.phase);

    // Done phase: select prompt based on doneMode
    if (state.phase === "done" && state.doneMode && store) {
      const doneModeTemplateMap: Record<string, string> = {
        "generate-docs": "generate-docs.md",
        "capture-learnings": "capture-learnings.md",
        "write-changelog": "write-changelog.md",
        "generate-bugfix-summary": "generate-bugfix-summary.md",
      };
      const filename = doneModeTemplateMap[state.doneMode];
      if (filename) {
        const modeTemplate = loadPromptFile(filename);
        if (modeTemplate) template = modeTemplate;
      }
      // files_changed for done-phase artifact prompts
      if (state.jjChangeId && await jj.isJJRepo()) {
        try { vars.files_changed = await jj.diff(state.jjChangeId); } catch { vars.files_changed = ""; }
      } else {
        vars.files_changed = "";
      }
      vars.learnings = store.getLearnings();
    }

    const finalPrompt = interpolatePrompt(template, vars);
    if (!finalPrompt) return;

    return {
      message: {
        customType: "megapowers-context",
        content: finalPrompt,
        display: false,
      },
    };
  });

  // --- TDD Guard: intercept file writes ---

  // --- Artifact protection: block writes to artifacts during read-only phases ---

  const READ_ONLY_PHASES: Phase[] = ["review", "verify", "code-review"];
  const PROTECTED_ARTIFACTS = ["spec.md", "plan.md", "brainstorm.md", "reproduce.md", "diagnosis.md"];

  pi.on("tool_call", async (event, _ctx) => {
    if (!state.phase || !state.activeIssue) return;
    if (!READ_ONLY_PHASES.includes(state.phase)) return;

    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    // Block writes to protected artifact files (by basename match)
    const basename = filePath.split("/").pop() ?? "";
    if (PROTECTED_ARTIFACTS.includes(basename)) {
      return {
        block: true,
        reason: `Cannot modify ${basename} during ${state.phase} phase. Artifacts are read-only in review/verify/code-review.`,
      };
    }
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

    // Inspect jj change for completed task
    if (phase === "implement" && result.stateUpdate.planTasks) {
      const completedTask = state.planTasks[state.currentTaskIndex];
      const changeId = completedTask ? state.taskJJChanges[completedTask.index] : undefined;
      if (changeId && completedTask && await jj.isJJRepo()) {
        try {
          const inspection = await inspectTaskChange(jj, changeId);
          const report = buildTaskCompletionReport(completedTask.index, completedTask.description, inspection);
          result.notifications.push(report);
        } catch {
          // jj inspection is best-effort — don't block completion
        }
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
    // Open-ended phases (brainstorm, reproduce, diagnose) suppress auto-prompts —
    // transitions happen only via explicit /phase next command.
    if (ctx.hasUI && !OPEN_ENDED_PHASES.has(phase)) {
      const validNext = getValidTransitions(state.workflow, phase);
      if (validNext.length > 0) {
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
        pi.appendEntry("megapowers-state", state);
      }

      // Done phase: capture artifacts from doneMode LLM output
      if (state.phase === "done" && state.doneMode && activeIssue && text.length > 100) {
        if (state.doneMode === "generate-docs") {
          store.writeFeatureDoc(activeIssue, text);
          ctx.ui.notify(`Feature doc saved to .megapowers/docs/${activeIssue}.md`, "info");
        }
        if (state.doneMode === "generate-bugfix-summary") {
          store.writeFeatureDoc(activeIssue, text);
          ctx.ui.notify(`Bugfix summary saved to .megapowers/docs/${activeIssue}.md`, "info");
        }
        if (state.doneMode === "write-changelog") {
          store.appendChangelog(text);
          ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
        }
        // capture-learnings: user manually reviews and uses /learn command
        // Clear doneMode after artifact capture (except capture-learnings which persists)
        if (state.doneMode !== "capture-learnings") {
          state = { ...state, doneMode: null };
          store.saveState(state);
        }
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
