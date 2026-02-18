import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createInitialState, getValidTransitions, type MegapowersState, type Phase } from "./state-machine.js";
import { createStore, type Store } from "./store.js";
import { createJJ, formatChangeDescription, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";
import { buildPhasePrompt } from "./prompts.js";
import { extractPlanTasks } from "./plan-parser.js";
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

    // Build vars for prompt interpolation
    const vars: Record<string, string> = {
      issue_slug: state.activeIssue,
      phase: state.phase,
    };

    // Load plan artifacts if they exist
    if (store) {
      const spec = store.readPlanFile(state.activeIssue, "spec.md");
      if (spec) vars.spec_content = spec;

      const plan = store.readPlanFile(state.activeIssue, "plan.md");
      if (plan) vars.plan_content = plan;

      const diagnosis = store.readPlanFile(state.activeIssue, "diagnosis.md");
      if (diagnosis) vars.diagnosis_content = diagnosis;
    }

    const prompt = buildPhasePrompt(state.phase, vars);
    if (!prompt) return;

    // Include relevant learnings
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

  // --- Agent completion: capture artifacts and offer transitions ---

  pi.on("agent_end", async (event, ctx) => {
    const activeIssue = state.activeIssue;
    const phase = state.phase;
    if (!activeIssue || !phase || !store) return;

    // Extract text from last assistant message
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (!lastAssistant) return;
    const text = getAssistantText(lastAssistant);
    if (!text) return;

    // Phase-specific artifact capture (always runs, even headless)
    if (phase === "spec" && text.length > 100) {
      store.ensurePlanDir(activeIssue);
      store.writePlanFile(activeIssue, "spec.md", text);
      if (ctx.hasUI) ctx.ui.notify("Spec saved.", "info");
    }

    if (phase === "plan" && text.length > 100) {
      store.ensurePlanDir(activeIssue);
      store.writePlanFile(activeIssue, "plan.md", text);
      const tasks = extractPlanTasks(text);
      state = { ...state, planTasks: tasks };
      store.saveState(state);
      if (ctx.hasUI) ctx.ui.notify(`Plan saved. ${tasks.length} tasks extracted.`, "info");
    }

    if (phase === "diagnose" && text.length > 100) {
      store.ensurePlanDir(activeIssue);
      store.writePlanFile(activeIssue, "diagnosis.md", text);
      if (ctx.hasUI) ctx.ui.notify("Diagnosis saved.", "info");
    }

    if (phase === "review") {
      const approved = /\bapproved?\b/i.test(text) && !/\bnot approved\b/i.test(text);
      if (approved) {
        state = { ...state, reviewApproved: true };
        store.saveState(state);
        if (ctx.hasUI) ctx.ui.notify("Review: approved.", "info");
      }
    }

    // Interactive-only: offer phase transition and update dashboard
    if (ctx.hasUI) {
      const validNext = getValidTransitions(state.workflow, phase);
      if (validNext.length > 0) {
        state = await ui.handlePhaseTransition(ctx, state, store, jj);
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
}
