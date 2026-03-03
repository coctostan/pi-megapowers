import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { Deps } from "../commands.js";
import type { MpRegistry } from "./mp-handlers.js";
import { createMpRegistry, MP_SUBCOMMANDS } from "./mp-handlers.js";

export async function dispatchMpCommand(
  args: string,
  ctx: ExtensionCommandContext,
  registry: MpRegistry,
): Promise<string | void> {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] ?? "help").toLowerCase();
  const rest = parts.slice(1).join(" ");

  const handler = registry[sub] ?? registry.help;
  return handler.execute(rest, ctx);
}

/**
 * Top-level /mp command handler used by index.ts.
 */
export async function handleMpCommand(args: string, ctx: ExtensionCommandContext, deps: Deps): Promise<void> {
  const registry = createMpRegistry(deps);
  const out = await dispatchMpCommand(args, ctx, registry);

  if (typeof out === "string" && out.trim()) {
    if (ctx.hasUI) ctx.ui.notify(out, "info");
  }
}

export function mpArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  // Completions only for the *first* argument (subcommand)
  const trimmed = argumentPrefix.replace(/^\s+/, "");
  if (trimmed.includes(" ")) return null;

  const items = [...MP_SUBCOMMANDS].map((s) => ({ value: s, label: s }));
  const filtered = items.filter((i) => i.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}
