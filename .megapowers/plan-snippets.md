# Plan insertion snippets (Option A: explicit shared deps + AC10 contingency)

Use the text below as copy/paste replacements in your `plan.md` Tasks 5–7 sections (or wherever you describe the extraction/wiring). This avoids ambiguity about `store/jj/ui` lifecycle and prevents hooks/commands from accidentally using different instances.

---

## Shared runtime deps (explicit)

Add this once near the start of the “Extract commands.ts / hooks.ts” work (Task 5/6), and reference it from both tasks.

```ts
// index.ts (single source of truth; shared by hooks + commands)
import type { Store } from "./state/store.js";
import type { JJ } from "./jj.js";
import type { MegapowersUI } from "./ui.js";

type RuntimeDeps = {
  store?: Store;
  jj?: JJ;
  ui?: MegapowersUI;
};

const runtimeDeps: RuntimeDeps = {};
```

Define a single initializer and use it everywhere:

```ts
// commands.ts (or a small shared module; simplest: keep in commands.ts and import from hooks.ts)
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createStore, type Store } from "./state/store.js";
import { createJJ, type JJ } from "./jj.js";
import { createUI, type MegapowersUI } from "./ui.js";

export type RuntimeDeps = { store?: Store; jj?: JJ; ui?: MegapowersUI };

export type Deps = {
  pi: ExtensionAPI;
  store: Store;
  jj: JJ;
  ui: MegapowersUI;
};

/**
 * The ONLY place allowed to create store/jj/ui.
 * Mutates `runtimeDeps` in-place so hooks and commands always share instances.
 */
export function ensureDeps(runtimeDeps: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!runtimeDeps.store) runtimeDeps.store = createStore(cwd);
  if (!runtimeDeps.jj) runtimeDeps.jj = createJJ(pi);
  if (!runtimeDeps.ui) runtimeDeps.ui = createUI();
  return { pi, store: runtimeDeps.store, jj: runtimeDeps.jj, ui: runtimeDeps.ui };
}
```

### Required wiring rule (state this explicitly in the plan)
- All command registrations call `ensureDeps(runtimeDeps, pi, ctx.cwd)` and pass the returned deps to `handleXCommand`.
- All hook registrations call `ensureDeps(runtimeDeps, pi, ctx.cwd)` and pass the returned deps to `onX`.
- No other module creates its own `store/jj/ui`.

---

## Task 5 (commands.ts) wording fix (self-contained extraction)

Replace “extract verbatim” with:

- For each `pi.registerCommand("<name>", { handler: async (args, ctx) => { ... } })` block in `index.ts`:
  1) Create a named export `handle<Name>Command(args, ctx, deps)` in `extensions/megapowers/commands.ts`.
  2) Move the handler body into that function unchanged.
  3) Replace free variables:
     - `pi` → `deps.pi`
     - `store` → `deps.store`
     - `jj` → `deps.jj`
     - `ui` → `deps.ui`
  4) In `index.ts`, replace the original handler with a thin wrapper:

```ts
import { ensureDeps, type RuntimeDeps } from "./commands.js";
import { handleMegaCommand /* ... */ } from "./commands.js";

const runtimeDeps: RuntimeDeps = {};

pi.registerCommand("mega", {
  description: "...",
  handler: async (args, ctx) => handleMegaCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
});
```

---

## Task 6 (hooks.ts) wording fix (shared deps + satellite exception)

State explicitly:
- Hooks extraction applies to the **non-satellite** path.
- Satellite-only handlers are moved in Task 7.

Wiring in `index.ts` should mirror commands:

```ts
import { ensureDeps } from "./commands.js";
import { onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";

pi.on("session_start", async (event, ctx) => onSessionStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("before_agent_start", async (event, ctx) => onBeforeAgentStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("tool_call", async (event, ctx) => onToolCall(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("tool_result", async (event, ctx) => onToolResult(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("agent_end", async (event, ctx) => onAgentEnd(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
```

---

## Task 7 (AC10) contingency (make the plan non-blocking)

Add this checkpoint:

1) After completing Tasks 5 and 6:

```bash
wc -l extensions/megapowers/index.ts
```

2) After moving satellite setup (Task 7):

```bash
wc -l extensions/megapowers/index.ts  # Must be <= 150
```

3) If `index.ts` is still >150 lines **after** Task 7, allow *one additional pure move* that does not change behavior:
- Create `extensions/megapowers/register-tools.ts` (or similar)
- Move one or more `pi.registerTool(...)` blocks verbatim out of `index.ts` into a `registerTools(pi, runtimeDeps)` function (still using `ensureDeps(runtimeDeps, pi, cwd)` as needed)
- `index.ts` calls `registerTools(...)`

This keeps the refactor purely structural while guaranteeing AC10.
