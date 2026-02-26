# Plan: Directory Restructure (#070)

All tasks are `[no-test]` — this is a pure refactor with existing tests covering all behavior. No new logic is introduced. Each task verifies correctness by running `bun test` and confirming zero regressions. After each move task, run `rg` sweeps to catch any lingering old import paths.

---

## Shared Runtime Deps Strategy (Option A)

Tasks 5–6 extract command and hook handlers from `index.ts`. Both must share the **same single set** of `store/jj/ui` instances. The wiring rule:

1. `index.ts` declares exactly one mutable deps object: `const runtimeDeps: RuntimeDeps = {};`
2. `commands.ts` exports `ensureDeps(runtimeDeps, pi, cwd)` — the **only** place allowed to create `store/jj/ui`. It mutates `runtimeDeps` in-place so all callers share instances.
3. Both command wrappers and hook wrappers call `ensureDeps(runtimeDeps, pi, ctx.cwd)` and pass the returned `Deps` to the extracted handler.
4. No other module creates its own `store/jj/ui`.

```typescript
// commands.ts (shared types + initializer)
export type RuntimeDeps = { store?: Store; jj?: JJ; ui?: MegapowersUI };
export type Deps = { pi: ExtensionAPI; store: Store; jj: JJ; ui: MegapowersUI };

export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.jj) rd.jj = createJJ(pi);
  if (!rd.ui) rd.ui = createUI();
  return { pi, store: rd.store, jj: rd.jj, ui: rd.ui };
}
```

---

### Task 1: Move state/ files and update all imports [no-test]

**Justification:** Pure file move + import path rewrite. Existing tests cover all state module behavior.

**Covers:** AC1, AC11, AC12, AC13

**Files:**
- Create: `extensions/megapowers/state/` (directory)
- Move: `extensions/megapowers/state-machine.ts` → `extensions/megapowers/state/state-machine.ts`
- Move: `extensions/megapowers/state-io.ts` → `extensions/megapowers/state/state-io.ts`
- Move: `extensions/megapowers/store.ts` → `extensions/megapowers/state/store.ts`
- Move: `extensions/megapowers/derived.ts` → `extensions/megapowers/state/derived.ts`
- Modify: All files that import from the moved modules (import paths change)

**Step 1 — Move files**

```bash
mkdir -p extensions/megapowers/state
mv extensions/megapowers/state-machine.ts extensions/megapowers/state/
mv extensions/megapowers/state-io.ts extensions/megapowers/state/
mv extensions/megapowers/store.ts extensions/megapowers/state/
mv extensions/megapowers/derived.ts extensions/megapowers/state/
```

**Step 2 — Update internal imports (within state/)**

Files in `state/` that import other `state/` files keep `./` prefix (same directory). Files that import from the parent (`plan-parser`, `spec-parser`) change `./X.js` → `../X.js`.

- `state/state-machine.ts`: No local imports — no changes.
- `state/state-io.ts`: `./state-machine.js` → stays `./state-machine.js` — no changes.
- `state/store.ts`: No local imports — no changes.
- `state/derived.ts`:
  - `./plan-parser.js` → `../plan-parser.js`
  - `./spec-parser.js` → `../spec-parser.js`
  - `./state-machine.js` → stays `./state-machine.js` — no change.

**Step 3 — Update imports in flat-root extension files**

Every file still in `extensions/megapowers/` that imports from `state-machine`, `state-io`, `store`, or `derived` needs `./X.js` → `./state/X.js`. Affected files:

- `write-policy.ts`: `./state-machine.js` → `./state/state-machine.js`
- `gates.ts`: `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`, `./derived.js` → `./state/derived.js`
- `phase-advance.ts`: `./state-io.js` → `./state/state-io.js`, `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`, `./derived.js` → `./state/derived.js`
- `tool-signal.ts`: `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`, `./state-machine.js` → `./state/state-machine.js`
- `tool-artifact.ts`: `./state-io.js` → `./state/state-io.js`
- `tool-overrides.ts`: `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`
- `tools.ts`: `./store.js` → `./state/store.js`
- `subagent-tools.ts`: `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`, `./store.js` → `./state/store.js`
- `subagent-validate.ts`: `./state-machine.js` → `./state/state-machine.js`
- `prompt-inject.ts`: `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`, `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`
- `prompts.ts`: `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`
- `plan-parser.ts`: `./state-machine.js` → `./state/state-machine.js`
- `spec-parser.ts`: `./state-machine.js` → `./state/state-machine.js`
- `ui.ts`: `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`, `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`
- `index.ts`: `./state-machine.js` → `./state/state-machine.js`, `./store.js` → `./state/store.js`, `./state-io.js` → `./state/state-io.js`, `./derived.js` → `./state/derived.js`

**Step 4 — Update test imports**

All test files in `tests/` that import from `../extensions/megapowers/state-machine.js`, `state-io.js`, `store.js`, or `derived.js` need the subdir inserted: `../extensions/megapowers/state/X.js`. Affected test files:

- `tests/derived.test.ts`
- `tests/gates.test.ts`
- `tests/index-integration.test.ts`
- `tests/phase-advance.test.ts`
- `tests/prompt-inject.test.ts`
- `tests/prompts.test.ts`
- `tests/state-io.test.ts`
- `tests/state-machine.test.ts`
- `tests/store.test.ts`
- `tests/subagent-tools.test.ts`
- `tests/subagent-validate.test.ts`
- `tests/tool-artifact.test.ts`
- `tests/tool-overrides.test.ts`
- `tests/tool-signal.test.ts`
- `tests/tools.test.ts`
- `tests/ui.test.ts`

**Step 5 — Sweep and verify**

```bash
# Verify no lingering old imports remain
rg 'from "\./state-machine\.js"' extensions/megapowers/*.ts
rg 'from "\./state-io\.js"' extensions/megapowers/*.ts
rg 'from "\./store\.js"' extensions/megapowers/*.ts
rg 'from "\./derived\.js"' extensions/megapowers/*.ts
rg 'megapowers/(state-machine|state-io|store|derived)\.js"' tests/
# All should return 0 matches

bun test
```
Expected: All tests pass, 0 compilation errors.

---

### Task 2: Move policy/ files and update all imports [no-test] [depends: 1]

**Justification:** Pure file move + import path rewrite. Existing tests cover all policy module behavior.

**Covers:** AC3, AC11, AC12, AC13

**Files:**
- Create: `extensions/megapowers/policy/` (directory)
- Move: `extensions/megapowers/write-policy.ts` → `extensions/megapowers/policy/write-policy.ts`
- Move: `extensions/megapowers/gates.ts` → `extensions/megapowers/policy/gates.ts`
- Move: `extensions/megapowers/phase-advance.ts` → `extensions/megapowers/policy/phase-advance.ts`
- Modify: All files that import from the moved modules

**Step 1 — Move files**

```bash
mkdir -p extensions/megapowers/policy
mv extensions/megapowers/write-policy.ts extensions/megapowers/policy/
mv extensions/megapowers/gates.ts extensions/megapowers/policy/
mv extensions/megapowers/phase-advance.ts extensions/megapowers/policy/
```

**Step 2 — Update internal imports (within policy/)**

Files in `policy/` now import `state/` modules via `../state/`. Files that import each other within `policy/` use `./`.

- `policy/write-policy.ts`: `./state/state-machine.js` → `../state/state-machine.js`
- `policy/gates.ts`: `./state/state-machine.js` → `../state/state-machine.js`, `./state/store.js` → `../state/store.js`, `./state/derived.js` → `../state/derived.js`, `./spec-parser.js` → `../spec-parser.js`
- `policy/phase-advance.ts`: `./state/state-io.js` → `../state/state-io.js`, `./state/state-machine.js` → `../state/state-machine.js`, `./gates.js` → `./gates.js` (same dir — no change), `./state/store.js` → `../state/store.js`, `./state/derived.js` → `../state/derived.js`, `./jj.js` → `../jj.js`

**Step 3 — Update imports in flat-root extension files**

- `tool-signal.ts`: `./phase-advance.js` → `./policy/phase-advance.js`
- `tool-overrides.ts`: `./write-policy.js` → `./policy/write-policy.js`
- `ui.ts`: `./gates.js` → `./policy/gates.js`
- `index.ts`: `./write-policy.js` → `./policy/write-policy.js`

**Step 4 — Update test imports**

Run sweep to find all test files importing these modules:
```bash
rg '(write-policy|gates|phase-advance)\.js"' tests/ --no-heading
```

Update all hits:
- `tests/gates.test.ts`: `../extensions/megapowers/gates.js` → `../extensions/megapowers/policy/gates.js`
- `tests/phase-advance.test.ts`: `../extensions/megapowers/phase-advance.js` → `../extensions/megapowers/policy/phase-advance.js`
- `tests/tool-overrides.test.ts`: check for direct `write-policy.js` imports and update if found

Note: There's no standalone `write-policy.test.ts` — write-policy is tested through `tool-overrides.test.ts`.

**Step 5 — Sweep and verify**

```bash
# Verify no lingering old imports
rg 'from "\./write-policy\.js"' extensions/megapowers/*.ts
rg 'from "\./gates\.js"' extensions/megapowers/*.ts
rg 'from "\./phase-advance\.js"' extensions/megapowers/*.ts
rg 'megapowers/(write-policy|gates|phase-advance)\.js"' tests/
# All should return 0 matches

bun test
```
Expected: All tests pass.

---

### Task 3: Move tools/ files and update all imports [no-test] [depends: 1, 2]

**Justification:** Pure file move + import path rewrite. Existing tests cover all tool module behavior.

**Covers:** AC2, AC11, AC12, AC13

**Files:**
- Create: `extensions/megapowers/tools/` (directory)
- Move: `extensions/megapowers/tool-signal.ts` → `extensions/megapowers/tools/tool-signal.ts`
- Move: `extensions/megapowers/tool-artifact.ts` → `extensions/megapowers/tools/tool-artifact.ts`
- Move: `extensions/megapowers/tool-overrides.ts` → `extensions/megapowers/tools/tool-overrides.ts`
- Move: `extensions/megapowers/tools.ts` → `extensions/megapowers/tools/tools.ts`
- Modify: All files that import from the moved modules

**Step 1 — Move files**

```bash
mkdir -p extensions/megapowers/tools
mv extensions/megapowers/tool-signal.ts extensions/megapowers/tools/
mv extensions/megapowers/tool-artifact.ts extensions/megapowers/tools/
mv extensions/megapowers/tool-overrides.ts extensions/megapowers/tools/
mv extensions/megapowers/tools.ts extensions/megapowers/tools/
```

**Step 2 — Update internal imports (within tools/)**

- `tools/tool-signal.ts`: `./state/state-io.js` → `../state/state-io.js`, `./policy/phase-advance.js` → `../policy/phase-advance.js`, `./state/derived.js` → `../state/derived.js`, `./state/state-machine.js` → `../state/state-machine.js`, `./task-coordinator.js` → `../task-coordinator.js`, `./jj.js` → `../jj.js`
- `tools/tool-artifact.ts`: `./state/state-io.js` → `../state/state-io.js`
- `tools/tool-overrides.ts`: `./state/state-io.js` → `../state/state-io.js`, `./state/derived.js` → `../state/derived.js`, `./policy/write-policy.js` → `../policy/write-policy.js`
- `tools/tools.ts`: `./state/store.js` → `../state/store.js`

**Step 3 — Update imports in flat-root extension files**

- `index.ts`: `./tool-signal.js` → `./tools/tool-signal.js`, `./tool-artifact.js` → `./tools/tool-artifact.js`, `./tool-overrides.js` → `./tools/tool-overrides.js`, `./tools.js` → `./tools/tools.js`

**Step 4 — Update test imports**

```bash
rg '(tool-signal|tool-artifact|tool-overrides|tools)\.js"' tests/ --no-heading
```

Update all hits:
- `tests/tool-signal.test.ts`: `../extensions/megapowers/tool-signal.js` → `../extensions/megapowers/tools/tool-signal.js`
- `tests/tool-artifact.test.ts`: `../extensions/megapowers/tool-artifact.js` → `../extensions/megapowers/tools/tool-artifact.js`
- `tests/tool-overrides.test.ts`: `../extensions/megapowers/tool-overrides.js` → `../extensions/megapowers/tools/tool-overrides.js`
- `tests/tools.test.ts`: `../extensions/megapowers/tools.js` → `../extensions/megapowers/tools/tools.js`

**Step 5 — Sweep and verify**

```bash
# Verify no lingering old imports
rg 'from "\./tool-signal\.js"' extensions/megapowers/*.ts
rg 'from "\./tool-artifact\.js"' extensions/megapowers/*.ts
rg 'from "\./tool-overrides\.js"' extensions/megapowers/*.ts
rg 'from "\./tools\.js"' extensions/megapowers/*.ts
rg 'megapowers/(tool-signal|tool-artifact|tool-overrides|tools)\.js"' tests/
# All should return 0 matches

bun test
```
Expected: All tests pass.

---

### Task 4: Move subagent/ files and update all imports [no-test] [depends: 1]

**Justification:** Pure file move + import path rewrite. Existing tests cover all subagent module behavior.

**Covers:** AC4, AC5, AC6, AC11, AC12, AC13

**Files:**
- Create: `extensions/megapowers/subagent/` (directory)
- Move: All 9 `extensions/megapowers/subagent-*.ts` files → `extensions/megapowers/subagent/`
- Modify: All files that import from the moved modules

**Step 1 — Move files**

```bash
mkdir -p extensions/megapowers/subagent
mv extensions/megapowers/subagent-agents.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-async.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-context.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-errors.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-runner.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-status.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-tools.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-validate.ts extensions/megapowers/subagent/
mv extensions/megapowers/subagent-workspace.ts extensions/megapowers/subagent/
```

**Step 2 — Update internal imports (within subagent/)**

Files in `subagent/` that import each other keep `./` prefix. Files that import from parent dirs change.

- `subagent/subagent-runner.ts`: `./subagent-errors.js` → stays `./subagent-errors.js` (same dir).
- `subagent/subagent-tools.ts`: `./state/state-io.js` → `../state/state-io.js`, `./state/derived.js` → `../state/derived.js`, `./state/store.js` → `../state/store.js`, `./jj-messages.js` → `../jj-messages.js`. All `./subagent-*.js` imports stay unchanged (same dir).
- `subagent/subagent-validate.ts`: `./state/state-machine.js` → `../state/state-machine.js`
- All other subagent files: no cross-module imports — no changes.

**Step 3 — Update imports in index.ts**

`index.ts` imports from many subagent modules. Update all:
- `./subagent-tools.js` → `./subagent/subagent-tools.js`
- `./subagent-status.js` → `./subagent/subagent-status.js`
- `./subagent-runner.js` → `./subagent/subagent-runner.js`
- `./subagent-workspace.js` → `./subagent/subagent-workspace.js`
- `./subagent-errors.js` → `./subagent/subagent-errors.js`

**Step 4 — Update test imports**

```bash
rg 'subagent-[a-z]+\.js"' tests/ --no-heading
```

Update all hits:
- `tests/subagent-agents.test.ts`: `../extensions/megapowers/subagent-agents.js` → `../extensions/megapowers/subagent/subagent-agents.js`
- `tests/subagent-async.test.ts`: `../extensions/megapowers/subagent-async.js` → `../extensions/megapowers/subagent/subagent-async.js`
- `tests/subagent-context.test.ts`: `../extensions/megapowers/subagent-context.js` → `../extensions/megapowers/subagent/subagent-context.js`
- `tests/subagent-errors.test.ts`: `../extensions/megapowers/subagent-errors.js` → `../extensions/megapowers/subagent/subagent-errors.js`
- `tests/subagent-runner.test.ts`: `../extensions/megapowers/subagent-runner.js` → `../extensions/megapowers/subagent/subagent-runner.js`
- `tests/subagent-status.test.ts`: `../extensions/megapowers/subagent-status.js` → `../extensions/megapowers/subagent/subagent-status.js`
- `tests/subagent-tools.test.ts`: `../extensions/megapowers/subagent-tools.js` → `../extensions/megapowers/subagent/subagent-tools.js` (also update any `subagent-status.js` import)
- `tests/subagent-validate.test.ts`: `../extensions/megapowers/subagent-validate.js` → `../extensions/megapowers/subagent/subagent-validate.js`
- `tests/subagent-workspace.test.ts`: `../extensions/megapowers/subagent-workspace.js` → `../extensions/megapowers/subagent/subagent-workspace.js`

**Step 5 — Sweep and verify**

```bash
# Verify no lingering old imports
rg 'from "\./subagent-' extensions/megapowers/*.ts
rg 'megapowers/subagent-[a-z]+\.js"' tests/ | grep -v 'megapowers/subagent/'
# All should return 0 matches

# Verify no moved source files remain in root
ls extensions/megapowers/*.ts
# Should only show: index.ts, ui.ts, prompts.ts, prompt-inject.ts, plan-parser.ts,
# spec-parser.ts, jj.ts, jj-messages.ts, satellite.ts, task-coordinator.ts

bun test
```
Expected: All tests pass.

---

### Task 5: Extract commands.ts from index.ts [no-test] [depends: 1, 2, 3, 4]

**Justification:** Pure extraction of existing code into a new file. All command behavior is tested via `index-integration.test.ts` and `ui.test.ts`. No logic changes.

**Covers:** AC7, AC10

**Files:**
- Create: `extensions/megapowers/commands.ts`
- Modify: `extensions/megapowers/index.ts`

**Step 1 — Create commands.ts with shared deps types and ensureDeps**

Create `extensions/megapowers/commands.ts`. Start with the shared deps infrastructure that both commands and hooks will use:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createStore, type Store } from "./state/store.js";
import { createJJ, type JJ } from "./jj.js";
import { createUI, filterTriageableIssues, formatTriageIssueList, type MegapowersUI } from "./ui.js";
import { readState, writeState } from "./state/state-io.js";
import { loadPromptFile, interpolatePrompt } from "./prompts.js";
import { handleSignal } from "./tools/tool-signal.js";
import { deriveTasks } from "./state/derived.js";

/** Mutable container — exactly one instance lives in index.ts, shared by all hooks and commands */
export type RuntimeDeps = { store?: Store; jj?: JJ; ui?: MegapowersUI };

/** Resolved deps — guaranteed non-optional */
export type Deps = { pi: ExtensionAPI; store: Store; jj: JJ; ui: MegapowersUI };

/**
 * The ONLY place allowed to create store/jj/ui.
 * Mutates runtimeDeps in-place so hooks and commands always share instances.
 */
export function ensureDeps(rd: RuntimeDeps, pi: ExtensionAPI, cwd: string): Deps {
  if (!rd.store) rd.store = createStore(cwd);
  if (!rd.jj) rd.jj = createJJ(pi);
  if (!rd.ui) rd.ui = createUI();
  return { pi, store: rd.store, jj: rd.jj, ui: rd.ui };
}
```

**Step 2 — Extract each command handler**

For each `pi.registerCommand("<name>", { handler: async (args, ctx) => { ... } })` block in `index.ts` (lines 620–870):

1. Create a named export `export async function handle<Name>Command(args: string, ctx: any, deps: Deps)` in `commands.ts`.
2. Move the handler body into that function **unchanged**.
3. Replace free variables:
   - `pi` → `deps.pi`
   - `store` → `deps.store`
   - `jj` → `deps.jj`
   - `ui` → `deps.ui`
4. Replace lazy-init guards (`if (!store) store = createStore(ctx.cwd);` etc.) — these are no longer needed because `ensureDeps` handles initialization before the handler is called.

Commands to extract (9 total):
- `handleMegaCommand` — from `/mega` (lines ~620-656). Note: references `pi.getActiveTools()` and `pi.setActiveTools()` → use `deps.pi.getActiveTools()` etc.
- `handleIssueCommand` — from `/issue` (lines ~658-674)
- `handleTriageCommand` — from `/triage` (lines ~676-690). Note: calls `pi.sendUserMessage()` → `deps.pi.sendUserMessage()`
- `handlePhaseCommand` — from `/phase` (lines ~692-723)
- `handleDoneCommand` — from `/done` (lines ~725-742)
- `handleLearnCommand` — from `/learn` (lines ~744-760)
- `handleTddCommand` — from `/tdd` (lines ~762-812)
- `handleTaskCommand` — from `/task` (lines ~814-842)
- `handleReviewCommand` — from `/review` (lines ~844-869)

**Step 3 — Update index.ts**

Replace all 9 `pi.registerCommand(...)` blocks with thin wrappers:

```typescript
import { handleMegaCommand, handleIssueCommand, handleTriageCommand,
         handlePhaseCommand, handleDoneCommand, handleLearnCommand,
         handleTddCommand, handleTaskCommand, handleReviewCommand,
         ensureDeps, type RuntimeDeps } from "./commands.js";

// Single shared deps object — one per extension lifetime
const runtimeDeps: RuntimeDeps = {};

pi.registerCommand("mega", {
  description: "Megapowers dashboard and controls (usage: /mega | /mega on | /mega off)",
  handler: async (args, ctx) => handleMegaCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
});
// ... same pattern for all 9 commands
```

Keep `getArgumentCompletions` callbacks inline in `index.ts` (they're tiny closures that don't reference deps).

Remove the module-level `let store: Store; let jj: JJ; let ui: MegapowersUI;` declarations since `runtimeDeps` replaces them.

**Step 4 — Verify**

```bash
bun test
```
Expected: All tests pass.

---

### Task 6: Extract hooks.ts from index.ts [no-test] [depends: 5]

**Justification:** Pure extraction of event hook handlers. All hook behavior is tested via `index-integration.test.ts`. No logic changes. Hooks extraction applies to the **non-satellite** path only — satellite-specific handlers move in Task 7.

**Covers:** AC8, AC10

**Files:**
- Create: `extensions/megapowers/hooks.ts`
- Modify: `extensions/megapowers/index.ts`

**Step 1 — Create hooks.ts**

Create `extensions/megapowers/hooks.ts`. Import `Deps` type from `commands.ts`:

```typescript
import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { checkJJAvailability } from "./jj.js";
import { JJ_INSTALL_MESSAGE, JJ_INIT_MESSAGE } from "./jj-messages.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { evaluateWriteOverride, recordTestFileWritten } from "./tools/tool-overrides.js";
import { getValidTransitions, OPEN_ENDED_PHASES } from "./state/state-machine.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";
```

**Step 2 — Extract each hook handler + helpers**

For each `pi.on("<event>", async (event, ctx) => { ... })` block in `index.ts` (the non-satellite ones, lines ~153-300):

1. Create a named export `export async function on<Event>(event: any, ctx: any, deps: Deps)`.
2. Move the handler body into that function unchanged.
3. Replace free variables: `pi` → `deps.pi`, `store` → `deps.store`, `jj` → `deps.jj`, `ui` → `deps.ui`.
4. Remove lazy-init guards (e.g. `if (!store) store = createStore(ctx.cwd);`) — `ensureDeps` handles this.

Hooks to extract (5 total):
- `onSessionStart` — from `pi.on("session_start", ...)` (lines ~153-199)
- `onBeforeAgentStart` — from `pi.on("before_agent_start", ...)` (lines ~200-216)
- `onToolCall` — from `pi.on("tool_call", ...)` (lines ~218-231)
- `onToolResult` — from `pi.on("tool_result", ...)` (lines ~233-248)
- `onAgentEnd` — from `pi.on("agent_end", ...)` (lines ~250-303)

Also move these helpers into `hooks.ts` (they're only used by `onAgentEnd`):
- `isAssistantMessage(m: AgentMessage): m is AssistantMessage` (lines ~30-32)
- `getAssistantText(message: AssistantMessage): string` (lines ~34-38)

**Step 3 — Update index.ts**

Replace all 5 `pi.on(...)` blocks with thin wrappers using the shared `runtimeDeps`:

```typescript
import { onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";
import { ensureDeps } from "./commands.js";

pi.on("session_start", async (event, ctx) => onSessionStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("before_agent_start", async (event, ctx) => onBeforeAgentStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("tool_call", async (event, ctx) => onToolCall(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("tool_result", async (event, ctx) => onToolResult(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
pi.on("agent_end", async (event, ctx) => onAgentEnd(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
```

Remove the `isAssistantMessage` and `getAssistantText` helper functions from `index.ts` (they moved to `hooks.ts`).

**Step 4 — Verify**

```bash
bun test
```
Expected: All tests pass.

---

### Task 7: Extract setupSatellite and registerTools, slim index.ts [no-test] [depends: 5, 6]

**Justification:** Pure extraction of the satellite mode block and tool registrations from index.ts. Tested by existing `satellite.test.ts`, `satellite-root.test.ts`, and `index-integration.test.ts`. No logic changes.

**Covers:** AC9, AC10

**Note on AC10:** After Tasks 5+6, the remaining tool registration blocks in `index.ts` total ~329 lines (signal: 27, artifact: 17, batch: 24, subagent: 238, status: 19). To meet ≤150 lines, tool registrations must also be extracted. This is a pure structural move (verbatim relocation of `pi.registerTool(...)` blocks), not a refactoring of the spawn logic itself. The spec's "out of scope" item refers to redesigning the subagent spawn pattern — moving the containing function to a different file is the same kind of pure move as Tasks 1–4.

**Files:**
- Modify: `extensions/megapowers/satellite.ts`
- Create: `extensions/megapowers/register-tools.ts`
- Modify: `extensions/megapowers/index.ts`

**Step 1 — Add setupSatellite() to satellite.ts**

Add a `setupSatellite(pi: ExtensionAPI): void` function to `satellite.ts` that contains everything inside the `if (satellite) { ... return; }` block in `index.ts` (lines ~51-148). This includes:

- The in-memory `satelliteTddState` variable
- The `pi.on("tool_call", ...)` handler for satellite write enforcement
- The `pi.on("tool_result", ...)` handler for satellite test file tracking
- The `pi.registerTool("megapowers_signal", ...)` for satellite TDD signals

The function signature: `export function setupSatellite(pi: ExtensionAPI): void`

Add these imports to `satellite.ts`:
```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { canWrite, isTestFile } from "./policy/write-policy.js";
import { Type } from "@sinclair/typebox";
```

**Step 2 — Create register-tools.ts**

Create `extensions/megapowers/register-tools.ts` that exports a single function containing all 5 `pi.registerTool(...)` blocks verbatim from `index.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { RuntimeDeps } from "./commands.js";
import { ensureDeps } from "./commands.js";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { readState, writeState } from "./state/state-io.js";
import { handleSignal } from "./tools/tool-signal.js";
import { handleSaveArtifact } from "./tools/tool-artifact.js";
import { createBatchHandler } from "./tools/tools.js";
import { handleSubagentDispatch, handleSubagentStatus } from "./subagent/subagent-tools.js";
import { writeSubagentStatus, updateSubagentStatus } from "./subagent/subagent-status.js";
import { buildSpawnArgs, buildSpawnEnv, createRunnerState, processJsonlLine } from "./subagent/subagent-runner.js";
import { buildWorkspaceName, buildWorkspaceAddArgs, buildWorkspaceForgetArgs, buildDiffSummaryArgs, buildDiffFullArgs } from "./subagent/subagent-workspace.js";
import { detectRepeatedErrors } from "./subagent/subagent-errors.js";
import { parseTaskDiffFiles } from "./task-coordinator.js";

export function registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void {
  // Move all 5 pi.registerTool(...) blocks here verbatim from index.ts
  // (megapowers_signal, megapowers_save_artifact, create_batch, subagent, subagent_status)
  // Replace free vars: store → ensureDeps(runtimeDeps, pi, ctx.cwd).store, etc.
  // The subagent tool's async spawn IIFE stays intact — just relocated, not redesigned.
}
```

For each tool registration, replace lazy-init patterns (`if (!jj) jj = createJJ(pi)`) with `const deps = ensureDeps(runtimeDeps, pi, ctx.cwd)` at the top of each `execute()`.

**Step 3 — Update index.ts**

Replace the satellite block and all tool registrations with thin calls:

```typescript
import { isSatelliteMode } from "./satellite.js";
import { setupSatellite } from "./satellite.js";
import { registerTools } from "./register-tools.js";
import { ensureDeps, type RuntimeDeps } from "./commands.js";
import { onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";
import { handleMegaCommand, handleIssueCommand, handleTriageCommand,
         handlePhaseCommand, handleDoneCommand, handleLearnCommand,
         handleTddCommand, handleTaskCommand, handleReviewCommand } from "./commands.js";

export default function megapowers(pi: ExtensionAPI): void {
  const satellite = isSatelliteMode({ isTTY: process.stdout.isTTY, env: process.env as Record<string, string | undefined> });
  if (satellite) { setupSatellite(pi); return; }

  const runtimeDeps: RuntimeDeps = {};

  // Hooks
  pi.on("session_start", async (event, ctx) => onSessionStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("before_agent_start", async (event, ctx) => onBeforeAgentStart(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("tool_call", async (event, ctx) => onToolCall(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("tool_result", async (event, ctx) => onToolResult(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));
  pi.on("agent_end", async (event, ctx) => onAgentEnd(event, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)));

  // Tools
  registerTools(pi, runtimeDeps);

  // Commands
  pi.registerCommand("mega", {
    description: "Megapowers dashboard and controls (usage: /mega | /mega on | /mega off)",
    handler: async (args, ctx) => handleMegaCommand(args, ctx, ensureDeps(runtimeDeps, pi, ctx.cwd)),
  });
  // ... same pattern for all 9 commands with getArgumentCompletions inline
}
```

**Step 4 — Verify line count and tests**

```bash
wc -l extensions/megapowers/index.ts  # Must be ≤150
bun test
```
Expected: `index.ts` ≤150 lines. All tests pass.

---

## AC Coverage Matrix

| AC | Task(s) | Description |
|----|---------|-------------|
| AC1 | Task 1 | state/ directory with 4 files |
| AC2 | Task 3 | tools/ directory with 4 files |
| AC3 | Task 2 | policy/ directory with 3 files |
| AC4 | Task 4 | subagent/ directory with 9 files |
| AC5 | Tasks 1-4 | Flat files remain in root |
| AC6 | Tasks 1-4 | No moved files remain in root |
| AC7 | Task 5 | commands.ts with 9 command handlers |
| AC8 | Task 6 | hooks.ts with 5 event hooks |
| AC9 | Task 7 | satellite.ts setupSatellite function |
| AC10 | Task 7 | index.ts ≤150 lines |
| AC11 | Tasks 1-7 | All tests pass (verified each step) |
| AC12 | Tasks 1-7 | All imports resolve (TypeScript compilation) |
| AC13 | Tasks 1-7 | No public API changes |