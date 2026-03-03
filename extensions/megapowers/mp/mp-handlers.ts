import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { handleMegaCommand, type Deps } from "../commands.js";

export type MpTier = "programmatic" | "inject" | "subagent";

export interface MpHandler {
  tier: MpTier;
  description: string;
  execute: (args: string, ctx: ExtensionCommandContext) => Promise<string | void>;
}

export type MpRegistry = Record<string, MpHandler>;

export const MP_SUBCOMMANDS = [
  "help",
  "new",
  "on",
  "off",
  "council",
  "audit",
  "health",
  "ship",
  "retro",
  "export",
  "quick",
  "back",
  "status",
] as const;

export function renderMpHelp(registry: MpRegistry): string {
  const names = Object.keys(registry).sort();

  const lines = names.map((name) => {
    const h = registry[name];
    return `- /mp ${name} — ${h.description}`;
  });

  return ["Megapowers Command Hub (/mp)", "", "Available subcommands:", "", ...lines].join("\n");
}

function comingSoonHandler(description: string): MpHandler {
  return {
    tier: "programmatic",
    description,
    execute: async () => "Coming soon.",
  };
}

function buildMpNewInjectPrompt(): string {
  return `You are drafting a new megapowers issue.

Conversation goals:
1) Ask the user for a short, specific title.
2) Ask for the type: feature or bugfix.
3) Ask for a detailed description.
4) Optionally ask for milestone (string) and priority (number).
5) Optionally ask for sources (array of issue IDs) if this is a batch.

Important rules:
- Do NOT create the issue directly.
- Once you have the information, call the tool \`create_issue\` exactly once.

When calling \`create_issue\`, pass:
- title: string (required)
- type: "feature" | "bugfix" (required)
- description: string (required)
- milestone: string (optional)
- priority: number (optional)
- sources: number[] (optional)
`;
}

/**
 * Registry factory for /mp handlers.
 */
export function createMpRegistry(deps: Deps): MpRegistry {
  // Declare first so help.execute can reference it.
  const registry: MpRegistry = {} as MpRegistry;

  registry.help = {
    tier: "programmatic",
    description: "Show help for /mp subcommands",
    execute: async () => renderMpHelp(registry),
  };

  registry.new = {
    tier: "inject",
    description: "Draft a new issue conversationally (will call create_issue)",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      const prompt = buildMpNewInjectPrompt();

      if (ctx.isIdle()) {
        deps.pi.sendUserMessage(prompt);
      } else {
        // If the agent is busy streaming, queue as follow-up.
        deps.pi.sendUserMessage(prompt, { deliverAs: "followUp" });
        if (ctx.hasUI) ctx.ui.notify("Queued issue-drafting prompt as follow-up.", "info");
      }
    },
  };

  registry.on = {
    tier: "programmatic",
    description: "Enable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("on", ctx as any, deps);
    },
  };

  registry.off = {
    tier: "programmatic",
    description: "Disable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("off", ctx as any, deps);
    },
  };

  // Stub subcommands for discoverability
  registry.council = comingSoonHandler("Multi-agent council (stub)");
  registry.audit = comingSoonHandler("Audit system health (stub)");
  registry.health = comingSoonHandler("Health checks (stub)");
  registry.ship = comingSoonHandler("Ship / wrap-up automation (stub)");
  registry.retro = comingSoonHandler("Retro / postmortem (stub)");
  registry.export = comingSoonHandler("Export artifacts (stub)");
  registry.quick = comingSoonHandler("Quick actions (stub)");
  registry.back = comingSoonHandler("Navigate backward (stub)");
  registry.status = comingSoonHandler("Show status (stub)");

  return registry;
}
