---
id: 2
title: Dispatch /mp subcommands (default help/unknown→help) and register /mp
  command with tab completions
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/index.ts
files_to_create:
  - extensions/megapowers/mp/mp-command.ts
---

### Task 2: Dispatch /mp subcommands (default help/unknown→help) and register /mp command with tab completions

**Files:**
- Create: `extensions/megapowers/mp/mp-command.ts`
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/mp-command.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";
import { dispatchMpCommand, mpArgumentCompletions } from "../extensions/megapowers/mp/mp-command.js";

function makeDeps() {
  const pi = {
    sendUserMessage: (_content: any, _opts?: any) => {},
    getActiveTools: () => [],
    setActiveTools: (_names: string[]) => {},
  } as any;

  return {
    pi,
    store: {} as any,
    ui: {} as any,
  } as any;
}

function makeCtx() {
  return {
    cwd: process.cwd(),
    hasUI: false,
    isIdle: () => true,
    ui: { notify: () => {} },
  } as any;
}

describe("/mp command hub dispatch", () => {
  it("/mp with no args dispatches to help (same as /mp help)", async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    const registry = createMpRegistry(deps);

    const a = await dispatchMpCommand("", ctx, registry);
    const b = await dispatchMpCommand("help", ctx, registry);

    expect(a).toBe(b);
    expect(a).toContain("Available subcommands");
  });

  it("unknown subcommand dispatches to help (same as /mp help)", async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    const registry = createMpRegistry(deps);

    const a = await dispatchMpCommand("nope", ctx, registry);
    const b = await dispatchMpCommand("help", ctx, registry);
    expect(a).toBe(b);
  });
});

describe("/mp argument completions", () => {
  it("returns completions for all registered subcommand names", () => {
    const all = mpArgumentCompletions("");
    expect(all).not.toBeNull();
    const values = (all ?? []).map((i) => i.value);

    // Spot-check a few, including stubs
    expect(values).toContain("help");
    expect(values).toContain("new");
    expect(values).toContain("status");
  });
});

describe("/mp is registered in index.ts", () => {
  it("registers a single /mp command", () => {
    const source = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    expect(source).toContain('pi.registerCommand("mp"');
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-command.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/mp/mp-command.js'`

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/mp/mp-command.ts`:
```ts
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
  const sub = parts[0] ?? "help";
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
```

Modify `extensions/megapowers/index.ts` to register `/mp` (keep all existing commands intact):
```ts
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand, handleReviewCommand,
  type RuntimeDeps,
} from "./commands.js";
import { handleMpCommand, mpArgumentCompletions } from "./mp/mp-command.js";

// ... inside export default function megapowers(pi) { ...

  pi.registerCommand("mp", {
    description: "Megapowers command hub (usage: /mp | /mp help | /mp new)",
    getArgumentCompletions: (prefix) => mpArgumentCompletions(prefix),
    handler: async (args, ctx) => handleMpCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });

  // existing commands remain registered below
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-command.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
