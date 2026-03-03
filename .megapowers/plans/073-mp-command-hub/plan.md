# Plan

### Task 1: Add /mp handler registry, help renderer, and stub subcommands

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

### Task 2: Dispatch /mp subcommands (default help/unknown→help) and register /mp command with tab completions [depends: 1]

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

### Task 3: Implement /mp on and /mp off by delegating to existing mega toggle logic [depends: 1, 2]

### Task 3: Implement /mp on and /mp off by delegating to existing mega toggle logic

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-on-off.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function makeMockPi() {
  let active = ["megapowers_signal", "subagent", "pipeline", "other"];
  return {
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names;
    },
    sendUserMessage: (_c: any, _o?: any) => {},
  } as any;
}

describe("/mp on|off", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mp-on-off-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("/mp off disables mega enforcement and hides custom tools (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });

    const pi = makeMockPi();
    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.off.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(false);
    expect(pi.getActiveTools()).not.toContain("megapowers_signal");
    expect(pi.getActiveTools()).not.toContain("subagent");
    expect(pi.getActiveTools()).not.toContain("pipeline");
  });

  it("/mp on enables mega enforcement and restores custom tools (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });

    const pi = makeMockPi();
    // simulate that tools were hidden
    pi.setActiveTools(["other"]);

    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.on.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(true);
    expect(pi.getActiveTools()).toContain("megapowers_signal");
    expect(pi.getActiveTools()).toContain("subagent");
    expect(pi.getActiveTools()).toContain("pipeline");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-on-off.test.ts`
Expected: FAIL — `expect(state.megaEnabled).toBe(false)` fails with `expected true to be false` (because the placeholder handlers from Task 1 return "Coming soon." and do not toggle state)

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/mp/mp-handlers.ts`:

1) Add the new import at the top of the file (alongside the existing `import type { Deps }`):

```ts
import { handleMegaCommand } from "../commands.js";
```

2) Inside `createMpRegistry()`, replace the placeholder `on` handler (which currently returns `"Coming soon."`) with:

```ts
  registry.on = {
    tier: "programmatic",
    description: "Enable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("on", ctx as any, deps);
    },
  };
```

3) Replace the placeholder `off` handler (which currently returns `"Coming soon."`) with:

```ts
  registry.off = {
    tier: "programmatic",
    description: "Disable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("off", ctx as any, deps);
    },
  };
```

All other handlers (`help`, `new`, stubs) remain unchanged from Task 1.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-on-off.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 4: Implement /mp new as an inject-tier handler that sends an issue-drafting prompt [depends: 1, 2]

### Task 4: Implement /mp new as an inject-tier handler that sends an issue-drafting prompt

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-new-inject.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect } from "bun:test";
import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";

describe("/mp new (inject)", () => {
  it("sends a conversational prompt that gathers title/type/description and optional milestone/priority, then instructs to call create_issue (AC6, AC7)", async () => {
    const sent: { content: any; opts?: any }[] = [];

    const pi = {
      sendUserMessage: (content: any, opts?: any) => sent.push({ content, opts }),
      getActiveTools: () => [],
      setActiveTools: (_names: string[]) => {},
    } as any;

    const deps = { pi, store: {} as any, ui: {} as any } as any;

    const ctx = {
      cwd: process.cwd(),
      hasUI: false,
      isIdle: () => true,
      ui: { notify: () => {} },
    } as any;

    const registry = createMpRegistry(deps);
    await registry.new.execute("", ctx);

    expect(sent.length).toBe(1);

    const prompt = typeof sent[0].content === "string" ? sent[0].content : JSON.stringify(sent[0].content);

    expect(prompt).toContain("title");
    expect(prompt).toContain("type");
    expect(prompt).toContain("description");
    expect(prompt).toContain("milestone");
    expect(prompt).toContain("priority");

    // Must instruct the model to call the tool (not create the issue directly)
    expect(prompt).toContain("create_issue");
    expect(prompt.toLowerCase()).toContain("call");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-new-inject.test.ts`
Expected: FAIL — `expected 0 to be 1` (because the placeholder handler does not call `pi.sendUserMessage()`)

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/mp/mp-handlers.ts` by replacing the placeholder `new` handler with an inject implementation.

Add this helper near the top (or bottom) of the file:
```ts
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
- type: \"feature\" | \"bugfix\" (required)
- description: string (required)
- milestone: string (optional)
- priority: number (optional)
- sources: number[] (optional)
`;
}
```

Then update the handler:
```ts
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
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-new-inject.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 5: Extend store.createIssue with optional milestone and priority, update formatIssueFile and consumers

### Task 5: Extend store.createIssue with optional milestone and priority, update formatIssueFile and consumers

**Covers:** AC12, AC13, AC14, AC15
**Files:**
- Modify: `extensions/megapowers/state/store.ts`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/store.test.ts`
- Test: `tests/store-milestone-priority.test.ts`
**Step 1 — Write the failing test**
Create `tests/store-milestone-priority.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, type Store } from "../extensions/megapowers/state/store.js";
let tmp: string;
let store: Store;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "store-ms-pr-"));
  store = createStore(tmp);
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("createIssue milestone and priority frontmatter (AC12-AC15)", () => {
  it("includes milestone: and priority: in frontmatter when provided", () => {
    const issue = store.createIssue("With both", "feature", "desc", undefined, "M2", 2);
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).toContain("milestone: M2");
    expect(content).toContain("priority: 2");
  });

  it("omits milestone: and priority: from frontmatter when not provided", () => {
    const issue = store.createIssue("Without extras", "feature", "desc");
    const content = readFileSync(join(tmp, ".megapowers", "issues", `${issue.slug}.md`), "utf-8");
    expect(content).not.toContain("milestone:");
    expect(content).not.toContain("priority:");
  });

  it("round-trips milestone and priority through getIssue", () => {
    const created = store.createIssue("Roundtrip", "feature", "desc", undefined, "M3", 5);
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBe("M3");
    expect(fetched!.priority).toBe(5);
  });

  it("returns undefined for milestone and priority when not provided", () => {
    const created = store.createIssue("Bare", "feature", "desc");
    const fetched = store.getIssue(created.slug);
    expect(fetched!.milestone).toBeUndefined();
    expect(fetched!.priority).toBeUndefined();
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/store-milestone-priority.test.ts`
Expected: FAIL — `TS2554: Expected 3-4 arguments, but got 6.` (because current `createIssue` only accepts `title, type, description, sources?`)
**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/state/store.ts`:
1) Update `Issue` interface — change `milestone` and `priority` from required to optional:

Old:
```ts
  milestone: string;
  priority: number;
```

New:
```ts
  milestone?: string;
  priority?: number;
```

2) Update `Store.createIssue` interface signature:

Old:
```ts
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue;
```

New:
```ts
  createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue;
```

3) Replace `formatIssueFile` entirely:

Old:
```ts
function formatIssueFile(issue: Issue): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}---

# ${issue.title}

${issue.description}
`;
}
```

New:
```ts
function formatIssueFile(issue: Issue): string {
  const sourcesLine = issue.sources.length > 0 ? `sources: [${issue.sources.join(", ")}]\n` : "";
  const milestoneLine = issue.milestone?.trim() ? `milestone: ${issue.milestone.trim()}\n` : "";
  const priorityLine = typeof issue.priority === "number" ? `priority: ${issue.priority}\n` : "";
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
created: ${new Date(issue.createdAt).toISOString()}
${sourcesLine}${milestoneLine}${priorityLine}---

# ${issue.title}

${issue.description}
`;
}
```

4) Update the `createIssue(...)` implementation signature and object construction:

Old:
```ts
    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[]): Issue {
```

New:
```ts
    createIssue(title: string, type: "feature" | "bugfix", description: string, sources?: number[], milestone?: string, priority?: number): Issue {
```

And in the issue object, replace:
```ts
        milestone: "",
        priority: 0,
```
with:
```ts
        milestone: milestone?.trim() ? milestone.trim() : undefined,
        priority: typeof priority === "number" ? priority : undefined,
```

5) Update `listIssues()` — in the returned object, change:

Old:
```ts
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
```

New:
```ts
            milestone: parsed.milestone,
            priority: parsed.priority,
```

6) Update `getIssue()` — same change:

Old:
```ts
            milestone: parsed.milestone ?? "",
            priority: parsed.priority ?? 0,
```

New:
```ts
            milestone: parsed.milestone,
            priority: parsed.priority,
```

7) Update `tests/store.test.ts` — find the test `"defaults milestone to empty string and priority to 0"` (around line 100):

Old assertions:
```ts
    expect(fetched!.milestone).toBe("");
    expect(fetched!.priority).toBe(0);
```

New assertions:
```ts
    expect(fetched!.milestone).toBeUndefined();
    expect(fetched!.priority).toBeUndefined();
```

8) Update `extensions/megapowers/prompt-inject.ts` — inside `buildIdlePrompt` (line 32), change:

Old:
```ts
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority})`,
```

New:
```ts
      `- #${String(i.id).padStart(3, "0")} ${i.title} (milestone: ${i.milestone || "none"}, priority: ${i.priority ?? "none"})`,
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/store-milestone-priority.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing

### Task 6: Absorbed into Task 5 (no work needed) [no-test] [depends: 5]

### Task 6: Absorbed into Task 5 (no work needed)

This task was merged into Task 5 per reviewer feedback. All milestone and priority changes (AC12-AC15) are now handled in Task 5.

**Verification step:** Confirm Task 5 is complete and `bun test` passes.

### Task 7: Register create_issue tool with Zod validation (missing title / invalid type → error) [depends: 5]

### Task 7: Register create_issue tool with Zod validation (missing title / invalid type → error)

**Files:**
- Create: `extensions/megapowers/tools/create-issue-schema.ts`
- Create: `extensions/megapowers/tools/tool-create-issue.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/create-issue-tool-validation.test.ts`

**Step 1 — Write the failing test**
Create `tests/create-issue-tool-validation.test.ts`:
```ts
import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";
import { registerTools } from "../extensions/megapowers/register-tools.js";
function extractText(result: any): string {
  const blocks = result?.content ?? [];
  return blocks.map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
}
describe("create_issue tool validation", () => {
  it("rejects missing title with a validation error message containing the failure (AC9)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-validate-"));
    try {
      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => (tools[tool.name] = tool),
        exec: async () => ({ code: 0, stdout: "", stderr: "" }),
      } as any;

      const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;
      registerTools(pi, runtimeDeps);

      expect(tools.create_issue).toBeDefined();

      const ctx = { cwd: tmp, hasUI: false } as any;
      const res = await tools.create_issue.execute(
        "1",
        { type: "feature", description: "desc" },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res).toLowerCase();

      expect(text).toContain("error");
      expect(text).toContain("title");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
  it("rejects invalid type with an error message (AC10)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-validate2-"));
    try {
      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => (tools[tool.name] = tool),
        exec: async () => ({ code: 0, stdout: "", stderr: "" }),
      } as any;

      const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;
      registerTools(pi, runtimeDeps);

      const ctx = { cwd: tmp, hasUI: false } as any;
      const res = await tools.create_issue.execute(
        "1",
        { title: "T", type: "nope", description: "desc" },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res).toLowerCase();

      expect(text).toContain("type");
      expect(text).toContain("feature");
      expect(text).toContain("bugfix");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/create-issue-tool-validation.test.ts`
Expected: FAIL — `expected undefined to be defined` (because `create_issue` is not registered yet)

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/tools/create-issue-schema.ts`:
```ts
import { z } from "zod";
export const CreateIssueInputSchema = z.object({
  title: z.string({ required_error: "title is required" }).min(1, "title is required"),
  type: z.enum(["feature", "bugfix"], { required_error: "type is required" }),
  description: z.string({ required_error: "description is required" }).min(1, "description is required"),
  milestone: z.string().min(1).optional(),
  priority: z.number().optional(),
  sources: z.array(z.number()).optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;
```

Create `extensions/megapowers/tools/tool-create-issue.ts`:
```ts
import { CreateIssueInputSchema } from "./create-issue-schema.js";
import type { Store } from "../state/store.js";

export type CreateIssueOk = { slug: string; id: number };
export type CreateIssueErr = { error: string };

export function createIssueHandler(
  store: Pick<Store, "createIssue">,
  params: unknown,
): CreateIssueOk | CreateIssueErr {
  const parsed = CreateIssueInputSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const p = parsed.data;
  const issue = store.createIssue(p.title, p.type, p.description, p.sources, p.milestone, p.priority);
  return { slug: issue.slug, id: issue.id };
}
```

Modify `extensions/megapowers/register-tools.ts` to register the new tool (place it near `create_batch`):
```ts
import { createIssueHandler } from "./tools/tool-create-issue.js";

// ... inside registerTools(pi, runtimeDeps)

  pi.registerTool({
    name: "create_issue",
    label: "Create Issue",
    description: "Create a new issue file via validated parameters.",
    // IMPORTANT: keep fields optional here so zod validation errors are returned from execute()
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "Required" })),
      type: Type.Optional(Type.String({ description: "Required: feature|bugfix" })),
      description: Type.Optional(Type.String({ description: "Required" })),
      milestone: Type.Optional(Type.String()),
      priority: Type.Optional(Type.Number()),
      sources: Type.Optional(Type.Array(Type.Number())),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { store } = ensureDeps(runtimeDeps, pi, ctx.cwd);
      const result = createIssueHandler(store, params);
      if ("error" in result) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: undefined,
      };
    },
  });
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/create-issue-tool-validation.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

### Task 8: Implement create_issue tool success path (calls store.createIssue and returns slug/id; milestone/priority written) [depends: 5, 7]

### Task 8: Implement create_issue tool success path (calls store.createIssue and returns slug/id; milestone/priority written)

**Files:**
- Test: `tests/create-issue-tool-success.test.ts`

**Step 1 — Write the failing test**
Create `tests/create-issue-tool-success.test.ts`:
```ts
import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerTools } from "../extensions/megapowers/register-tools.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";
function extractText(result: any): string {
  const blocks = result?.content ?? [];
  return blocks.map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
}
describe("create_issue tool success", () => {
  it("creates the issue via store.createIssue and returns slug and id as JSON (AC11) and writes milestone/priority frontmatter (AC13-AC15)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "create-issue-success-"));
    try {
      const tools: Record<string, any> = {};
      const pi = {
        registerTool: (tool: any) => (tools[tool.name] = tool),
        exec: async () => ({ code: 0, stdout: "", stderr: "" }),
      } as any;
      const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;
      registerTools(pi, runtimeDeps);
      expect(tools.create_issue).toBeDefined();
      const ctx = { cwd: tmp, hasUI: false } as any;
      const res = await tools.create_issue.execute(
        "1",
        {
          title: "My feature",
          type: "feature",
          description: "Do the thing",
          milestone: "M2",
          priority: 2,
          sources: [1, 2],
        },
        undefined,
        undefined,
        ctx,
      );
      const text = extractText(res);
      const parsed = JSON.parse(text);
      expect(typeof parsed.slug).toBe("string");
      expect(typeof parsed.id).toBe("number");
      expect(parsed.slug).toContain("my-feature");
      const issuePath = join(tmp, ".megapowers", "issues", `${parsed.slug}.md`);
      const content = readFileSync(issuePath, "utf-8");
      expect(content).toContain("milestone: M2");
      expect(content).toContain("priority: 2");
      expect(content).toContain("sources: [1, 2]");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/create-issue-tool-success.test.ts`
Expected: FAIL — `expect(tools.create_issue).toBeDefined()` passes, but `JSON.parse(text)` succeeds (Task 7 already returns JSON). The actual failure will be a missing issue file or wrong frontmatter if Task 5's store changes aren't applied yet. If Task 5 and 7 are both complete, this test should pass immediately — confirming that the success path works end-to-end.
**Step 3 — Write minimal implementation**
No production code changes needed — Task 7 already returns `JSON.stringify(result)` on success, and Task 5 already extended `store.createIssue` to accept and persist `milestone` and `priority`. This task only adds the success-path test.
**Step 4 — Run test, verify it passes**
Run: `bun test tests/create-issue-tool-success.test.ts`
Expected: PASS
Run: `bun test`
Expected: all passing

### Task 9: Verify existing standalone commands remain registered alongside /mp [no-test] [depends: 2]

### Task 9: Verify existing standalone commands remain registered alongside /mp
**[no-test] justification:** This is a verification-only task with no production code. It depends on Task 2 which adds `/mp` registration. By the time this task runs, the test should already pass. The test exists as a guard rail to confirm AC19.
**Files:**
- Create: `tests/mp-existing-commands.test.ts`

**Verification step:**

1) Create `tests/mp-existing-commands.test.ts`:
```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
  it("keeps existing standalone commands while adding /mp", () => {
    const source = readFileSync(join(process.cwd(), "extensions", "megapowers", "index.ts"), "utf-8");
    expect(source).toContain('pi.registerCommand("mp"');
    for (const cmd of ["mega", "issue", "triage", "phase", "done", "learn", "tdd", "task", "review"]) {
      expect(source).toContain(`pi.registerCommand("${cmd}"`);
    }
  });
});
```

2) Run: `bun test tests/mp-existing-commands.test.ts`
   Expected: PASS (Task 2 already added `/mp` registration; existing commands were never removed)

3) Run: `bun test`
   Expected: all passing
