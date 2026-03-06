---
id: 11
title: Wire async handlePlanDraftDone with real completeFn in register-tools.ts
status: approved
depends_on:
  - 9
  - 10
no_test: true
files_to_modify:
  - extensions/megapowers/register-tools.ts
files_to_create: []
---

**Covers:** AC12, AC21

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`

**[no-test] justification:** This is thin integration wiring — it passes `completeFn` (built from `modelRegistry` + `complete()`) through to `handlePlanDraftDone`. The behavioral correctness of `handlePlanDraftDone` with a `completeFn` is already thoroughly tested in Tasks 9 and 10. TypeScript's type system verifies the wiring at compile time. A source-code string assertion test would be brittle; an integration test would require mocking the full extension context for minimal added value.

**Step 1 — Implementation**

Update imports in `extensions/megapowers/register-tools.ts`. The existing `handleSignal` import (line 7) needs updating, and new imports are added:

```typescript
// Update existing import (line 7) to also export handlePlanDraftDone and SignalResult:
import { handleSignal, handlePlanDraftDone, type SignalResult } from "./tools/tool-signal.js";

// Add new imports:
import { complete } from "@mariozechner/pi-ai/dist/stream.js";
import type { CompleteFn } from "./validation/plan-lint-model.js";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
```

Add helper function in `register-tools.ts` outside `registerTools(...)`:

```typescript
async function buildLintCompleteFn(
  ctx: { modelRegistry: ModelRegistry },
): Promise<CompleteFn | undefined> {
  const model =
    ctx.modelRegistry.find("anthropic", "claude-haiku-4-5") ??
    ctx.modelRegistry.find("anthropic", "claude-3-5-haiku-latest");
  if (!model) return undefined;
  const apiKey = await ctx.modelRegistry.getApiKey(model);
  if (!apiKey) return undefined;
  return async (prompt: string) => {
    const response = await complete(
      model,
      {
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }],
          timestamp: Date.now(),
        }],
      },
      { apiKey },
    );
    return response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  };
}
```

Update the `megapowers_signal` execute handler to intercept `plan_draft_done` before delegating to `handleSignal`:

```typescript
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const { store, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
  let result: SignalResult;
  if (params.action === "plan_draft_done") {
    const completeFn = await buildLintCompleteFn(ctx);
    result = await handlePlanDraftDone(ctx.cwd, completeFn);
  } else {
    result = await handleSignal(ctx.cwd, params.action, params.target);
  }
  if (result.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
  }
  if (result.triggerNewSession) {
    (ctx.sessionManager as any)?.newSession?.();
  }
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
  return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
},
```

**Step 2 — Verify**
Run: `bun typecheck` (or `npx tsc --noEmit`)
Expected: No type errors

Run: `bun test`
Expected: All tests passing (Tasks 9/10 tests verify the async handlePlanDraftDone behavior)
