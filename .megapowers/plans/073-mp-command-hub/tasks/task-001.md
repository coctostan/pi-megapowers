---
id: 1
title: Add /mp handler registry, help renderer, and stub subcommands
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/mp/mp-handlers.ts
---

### Task 1: Add /mp handler registry, help renderer, and stub subcommands

**Files:**
- Create: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-help.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect } from "bun:test";
import { createMpRegistry, renderMpHelp } from "../extensions/megapowers/mp/mp-handlers.js";

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

describe("/mp help", () => {
  it("renders a formatted help listing that includes all registered subcommands and their descriptions", async () => {
    const deps = makeDeps();
    const registry = createMpRegistry(deps);

    const helpText = renderMpHelp(registry);

    // Must include all subcommands from the spec
    const expectedSubs = [
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
    ];

    for (const sub of expectedSubs) {
      expect(helpText).toContain(`/mp ${sub}`);
      expect(helpText).toContain(registry[sub].description);
    }

    // Basic formatting contract
    expect(helpText).toContain("Megapowers");
    expect(helpText.split("\n").some((l) => l.includes("—"))).toBe(true);
  });

  it("stub handlers return Coming soon.", async () => {
    const deps = makeDeps();
    const registry = createMpRegistry(deps);

    const ctx = { hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;
    const result = await registry.council.execute("", ctx);
    expect(result).toBe("Coming soon.");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-help.test.ts`
Expected: FAIL — `error: Cannot find module '../extensions/megapowers/mp/mp-handlers.js'` (or equivalent missing module error)

**Step 3 — Write minimal implementation**
Create `extensions/megapowers/mp/mp-handlers.ts`:
```ts
import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Deps } from "../commands.js";

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

  return [
    "Megapowers Command Hub (/mp)",
    "",
    "Available subcommands:",
    "",
    ...lines,
  ].join("\n");
}

function comingSoonHandler(description: string): MpHandler {
  return {
    tier: "programmatic",
    description,
    execute: async () => "Coming soon.",
  };
}

/**
 * Registry factory. The real behavior for some handlers (on/off/new)
 * is implemented in later tasks; for now they exist for discoverability.
 */
export function createMpRegistry(_deps: Deps): MpRegistry {
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
    execute: async () => {
      return "Coming soon.";
    },
  };

  registry.on = {
    tier: "programmatic",
    description: "Enable megapowers enforcement",
    execute: async () => {
      return "Coming soon.";
    },
  };

  registry.off = {
    tier: "programmatic",
    description: "Disable megapowers enforcement",
    execute: async () => {
      return "Coming soon.";
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
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-help.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
