import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isSatelliteMode, setupSatellite } from "./satellite.js";
import { registerTools } from "./register-tools.js";
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand, handleReviewCommand,
  type RuntimeDeps,
} from "./commands.js";
import { onContext, onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";

// --- Extension ---

export default function megapowers(pi: ExtensionAPI): void {
  // --- Satellite mode: TDD-only for subagent sessions ---
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    setupSatellite(pi);
    return;
  }

  // Single shared deps object — one per extension lifetime
  const runtimeDeps: RuntimeDeps = {};

  // --- Hooks ---

  pi.on("session_start", async (event, ctx) => onSessionStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("before_agent_start", async (event, ctx) => onBeforeAgentStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("context", async (event, ctx) => onContext(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));

  pi.on("tool_call", async (event, ctx) => onToolCall(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("tool_result", async (event, ctx) => onToolResult(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("agent_end", async (event, ctx) => onAgentEnd(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));

  // --- Tools ---

  registerTools(pi, runtimeDeps);

  // --- Commands ---

  pi.registerCommand("mega", {
    description: "Megapowers dashboard and controls (usage: /mega | /mega on | /mega off)",
    handler: async (args, ctx) => handleMegaCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("issue", {
    description: "Create or switch issues (usage: /issue new | /issue list | /issue <slug>)",
    getArgumentCompletions: (prefix) => {
      const subs = ["new", "list"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => handleIssueCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("triage", {
    description: "Triage open issues into batches",
    handler: async (args, ctx) => handleTriageCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("phase", {
    description: "Phase management (usage: /phase | /phase next)",
    handler: async (args, ctx) => handlePhaseCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("done", {
    description: "Trigger wrap-up menu (when in done phase)",
    handler: async (args, ctx) => handleDoneCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("learn", {
    description: "Capture a learning",
    handler: async (args, ctx) => handleLearnCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("tdd", {
    description: "TDD guard control (usage: /tdd skip | /tdd status)",
    getArgumentCompletions: (prefix) => {
      const subs = ["skip", "status"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => handleTddCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("task", {
    description: "Task management (usage: /task done)",
    getArgumentCompletions: (prefix) => {
      const subs = ["done"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => handleTaskCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  pi.registerCommand("review", {
    description: "Review management (usage: /review approve)",
    getArgumentCompletions: (prefix) => {
      const subs = ["approve"];
      const filtered = subs.filter((s) => s.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
    },
    handler: async (args, ctx) => handleReviewCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });
}
