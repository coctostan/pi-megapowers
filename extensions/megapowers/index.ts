import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createWriteTool, createEditTool, createBashTool } from "@mariozechner/pi-coding-agent";
import { getValidTransitions, OPEN_ENDED_PHASES, type Phase } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, type JJ } from "./jj.js";
import { createUI, filterTriageableIssues, formatTriageIssueList, type MegapowersUI } from "./ui.js";
import { loadPromptFile, interpolatePrompt } from "./prompts.js";
import { isSatelliteMode } from "./satellite.js";
import { createBatchHandler } from "./tools.js";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { readState, writeState } from "./state-io.js";
import { handleSignal } from "./tool-signal.js";
import { handleSaveArtifact } from "./tool-artifact.js";
import { evaluateWriteOverride, recordTestFileWritten, processBashResult } from "./tool-overrides.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { deriveTasks } from "./derived.js";
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
    // Satellite sessions use disk-backed state (written by parent session).
    // No module-level state needed — all reads/writes go through state-io.

    pi.on("tool_call", async (event, ctx) => {
      const toolName = event.toolName;
      if (toolName !== "write" && toolName !== "edit") return;

      const filePath: string | undefined = (event.input as any)?.path;
      if (!filePath) return;

      const decision = evaluateWriteOverride(ctx.cwd, filePath);
      if (!decision.allowed) {
        return { block: true, reason: decision.reason };
      }
    });

    pi.on("tool_result", async (event, ctx) => {
      const toolName = event.toolName;

      // After a successful write of a test file, record TDD state transition
      if ((toolName === "write" || toolName === "edit") && !event.isError) {
        const filePath: string | undefined = (event.input as any)?.path;
        if (filePath) {
          const decision = evaluateWriteOverride(ctx.cwd, filePath);
          if (decision.updateTddState) {
            recordTestFileWritten(ctx.cwd);
          }
        }
      }

      // After bash, track test runner results for TDD RED detection
      if (toolName === "bash") {
        const command = (event.input as any)?.command;
        if (command) processBashResult(ctx.cwd, command, event.isError);
      }
    });

    return; // Skip all primary session setup
  }

  // Module-level capability objects (lazily initialized, not state)
  let store: Store;
  let jj: JJ;
  let ui: MegapowersUI;

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    store = createStore(ctx.cwd);
    jj = createJJ(pi);
    ui = createUI();

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
      if (currentId && currentId !== currentState.jjChangeId) {
        if (ctx.hasUI) {
          const choice = await ctx.ui.select(
            `jj change mismatch: on ${currentId.slice(0, 8)}, expected ${currentState.jjChangeId.slice(0, 8)} for ${currentState.activeIssue}`,
            ["Continue on current change", "Ignore (update stored ID)"]
          );
          if (choice?.startsWith("Ignore")) {
            writeState(ctx.cwd, { ...currentState, jjChangeId: currentId });
          }
        }
      }
    }

    // Render dashboard
    if (ctx.hasUI) {
      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    }
  });

  // --- Prompt injection ---

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!store) store = createStore(ctx.cwd);
    if (!jj) jj = createJJ(pi);

    const prompt = buildInjectedPrompt(ctx.cwd, store, jj);
    if (!prompt) return;

    return {
      message: {
        customType: "megapowers-context",
        content: prompt,
        display: false,
      },
    };
  });

  // --- Write/edit override: disk-backed write policy ---

  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath: string | undefined = (event.input as any)?.path;
    if (!filePath) return;

    const decision = evaluateWriteOverride(ctx.cwd, filePath);
    if (!decision.allowed) {
      return { block: true, reason: decision.reason };
    }
  });

  // --- After write/edit: track test file writes; after bash: track test results ---

  pi.on("tool_result", async (event, ctx) => {
    const toolName = event.toolName;

    if ((toolName === "write" || toolName === "edit") && !event.isError) {
      const filePath: string | undefined = (event.input as any)?.path;
      if (filePath) {
        const decision = evaluateWriteOverride(ctx.cwd, filePath);
        if (decision.updateTddState) {
          recordTestFileWritten(ctx.cwd);
        }
      }
    }

    if (toolName === "bash") {
      const command = (event.input as any)?.command;
      if (command) processBashResult(ctx.cwd, command, event.isError);
    }
  });

  // --- Agent completion: offer phase transitions ---

  pi.on("agent_end", async (event, ctx) => {
    if (!store) store = createStore(ctx.cwd);
    if (!jj) jj = createJJ(pi);
    if (!ui) ui = createUI();

    const state = readState(ctx.cwd);
    if (!state.activeIssue || !state.phase) return;

    const phase = state.phase;

    // Done-phase artifact capture (when LLM generates content from doneMode prompt)
    if (phase === "done" && state.doneMode) {
      const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
      if (lastAssistant) {
        const text = getAssistantText(lastAssistant);
        if (text && text.length > 100) {
          if (state.doneMode === "generate-docs" || state.doneMode === "generate-bugfix-summary") {
            store.writeFeatureDoc(state.activeIssue, text);
            if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
          }
          if (state.doneMode === "write-changelog") {
            store.appendChangelog(text);
            if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
          }
          if (state.doneMode !== "capture-learnings") {
            writeState(ctx.cwd, { ...state, doneMode: null });
          }
        }
      }
    }

    // Interactive-only: offer phase transitions
    // Open-ended phases (brainstorm, reproduce, diagnose) suppress auto-prompts —
    // transitions happen only via explicit /phase next or megapowers_signal
    if (ctx.hasUI && !OPEN_ENDED_PHASES.has(phase)) {
      const freshState = readState(ctx.cwd);
      const validNext = getValidTransitions(freshState.workflow, phase);
      if (validNext.length > 0) {
        const newState = await ui.handlePhaseTransition(ctx, freshState, store, jj);
        writeState(ctx.cwd, newState);
      }

      // Done phase: wrap-up menu
      const afterTransition = readState(ctx.cwd);
      if (afterTransition.phase === "done") {
        const afterDone = await ui.handleDonePhase(ctx, afterTransition, store, jj);
        writeState(ctx.cwd, afterDone);
      }

      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    }
  });

  // --- Tools: megapowers_signal ---

  pi.registerTool({
    name: "megapowers_signal",
    label: "Megapowers Signal",
    description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), review_approve (approve plan in review phase), phase_next (advance to next workflow phase).",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("task_done"),
        Type.Literal("review_approve"),
        Type.Literal("phase_next"),
      ]),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!jj) jj = createJJ(pi);
      const result = handleSignal(ctx.cwd, params.action, jj);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (ctx.hasUI && store && ui) {
        ui.renderDashboard(ctx, readState(ctx.cwd), store);
      }
      return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
    },
  });

  // --- Tools: megapowers_save_artifact ---

  pi.registerTool({
    name: "megapowers_save_artifact",
    label: "Save Artifact",
    description: "Save a phase artifact to disk. Use phase names: spec, plan, brainstorm, reproduce, diagnosis, verify, code-review.",
    parameters: Type.Object({
      phase: Type.String(),
      content: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSaveArtifact(ctx.cwd, params.phase, params.content);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
    },
  });

  // --- Tools: create_batch ---

  pi.registerTool({
    name: "create_batch",
    label: "Create Batch Issue",
    description: "Create a batch issue grouping source issues.",
    parameters: Type.Object({
      title: Type.String(),
      type: StringEnum(["bugfix", "feature"] as const),
      sourceIds: Type.Array(Type.Number()),
      description: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!store) store = createStore(ctx.cwd);
      const result = createBatchHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: result.error }], details: undefined };
      }
      return {
        content: [{ type: "text", text: `Created batch: ${result.slug} (id: ${result.id})` }],
        details: undefined,
      };
    },
  });

  // --- Commands ---

  pi.registerCommand("mega", {
    description: "Megapowers dashboard and controls (usage: /mega | /mega on | /mega off)",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!ui) ui = createUI();

      const sub = args.trim().toLowerCase();

      if (sub === "off") {
        const state = readState(ctx.cwd);
        writeState(ctx.cwd, { ...state, megaEnabled: false });
        // Hide custom tools from LLM (AC38)
        const activeTools = pi.getActiveTools().filter(
          t => t !== "megapowers_signal" && t !== "megapowers_save_artifact"
        );
        pi.setActiveTools(activeTools);
        if (ctx.hasUI) ctx.ui.notify("Megapowers OFF — all enforcement disabled.", "info");
        return;
      }

      if (sub === "on") {
        const state = readState(ctx.cwd);
        writeState(ctx.cwd, { ...state, megaEnabled: true });
        // Restore custom tools (AC38)
        const activeTools = pi.getActiveTools();
        if (!activeTools.includes("megapowers_signal")) {
          pi.setActiveTools([...activeTools, "megapowers_signal", "megapowers_save_artifact"]);
        }
        if (ctx.hasUI) ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
        return;
      }

      ui.renderDashboard(ctx, readState(ctx.cwd), store);
    },
  });

  pi.registerCommand("issue", {
    description: "Create or switch issues (usage: /issue new | /issue list | /issue <slug>)",
    getArgumentCompletions: (prefix) => {
      const subs = ["new", "list"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();

      const state = readState(ctx.cwd);
      const newState = await ui.handleIssueCommand(ctx, state, store, jj, args);
      writeState(ctx.cwd, newState);
    },
  });

  pi.registerCommand("triage", {
    description: "Triage open issues into batches",
    handler: async (_args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      const issues = filterTriageableIssues(store.listIssues());
      if (issues.length === 0) {
        if (ctx.hasUI) ctx.ui.notify("No open issues to triage.", "info");
        return;
      }
      const issueList = formatTriageIssueList(issues);
      const template = loadPromptFile("triage.md");
      const prompt = interpolatePrompt(template, { open_issues: issueList });
      pi.sendUserMessage(prompt);
    },
  });

  pi.registerCommand("phase", {
    description: "Phase management (usage: /phase | /phase next)",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();

      if (args.trim() === "next") {
        const result = handleSignal(ctx.cwd, "phase_next", jj);
        if (result.error) {
          if (ctx.hasUI) ctx.ui.notify(result.error, "error");
        } else {
          if (ctx.hasUI) {
            ctx.ui.notify(result.message ?? "Phase advanced.", "info");
            ui.renderDashboard(ctx, readState(ctx.cwd), store);
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
    },
  });

  pi.registerCommand("done", {
    description: "Trigger wrap-up menu (when in done phase)",
    handler: async (_args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();

      const state = readState(ctx.cwd);
      if (state.phase !== "done") {
        if (ctx.hasUI) ctx.ui.notify("Not in done phase. Use /phase next to advance.", "info");
        return;
      }

      const newState = await ui.handleDonePhase(ctx, state, store, jj);
      writeState(ctx.cwd, newState);
      if (ctx.hasUI) ui.renderDashboard(ctx, readState(ctx.cwd), store);
    },
  });

  pi.registerCommand("learn", {
    description: "Capture a learning",
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);

      if (args.trim()) {
        store.appendLearning(args.trim());
        if (ctx.hasUI) ctx.ui.notify("Learning captured.", "info");
      } else {
        const learning = await ctx.ui.input("What did you learn?");
        if (learning?.trim()) {
          store.appendLearning(learning.trim());
          if (ctx.hasUI) ctx.ui.notify("Learning captured.", "info");
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
      if (!store) store = createStore(ctx.cwd);
      if (!ui) ui = createUI();
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
          ui.renderDashboard(ctx, readState(ctx.cwd), store);
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
    },
  });

  pi.registerCommand("task", {
    description: "Task management (usage: /task done)",
    getArgumentCompletions: (prefix) => {
      const subs = ["done"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();
      const sub = args.trim();

      if (sub === "done") {
        const result = handleSignal(ctx.cwd, "task_done", jj);
        if (result.error) {
          if (ctx.hasUI) ctx.ui.notify(result.error, "error");
        } else {
          if (ctx.hasUI) {
            ctx.ui.notify(result.message ?? "Task marked complete.", "info");
            ui.renderDashboard(ctx, readState(ctx.cwd), store);
          }
        }
        return;
      }

      if (ctx.hasUI) ctx.ui.notify("Usage: /task done", "info");
    },
  });

  pi.registerCommand("review", {
    description: "Review management (usage: /review approve)",
    getArgumentCompletions: (prefix) => {
      const subs = ["approve"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => {
      if (!store) store = createStore(ctx.cwd);
      if (!jj) jj = createJJ(pi);
      if (!ui) ui = createUI();
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
    },
  });
}
