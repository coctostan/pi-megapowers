---
id: 3
title: Remove T1 model wiring from register-tools
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/register-tools.ts
  - tests/register-tools.test.ts
files_to_create: []
---

### Task 3: Remove T1 model wiring from register-tools [depends: 2]

Covers Fixed When: 3, 4

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/register-tools.test.ts`

`tests/register-tools.test.ts` already exists and already reads `extensions/megapowers/register-tools.ts` as source text for wiring assertions. This task adds one more source-level regression test to that existing file and keeps `tests/new-session-wiring.test.ts` as the runtime guard for `newSession()` behavior.

**Step 1 — Write the failing test**
Add this test to the existing `tests/register-tools.test.ts` file:

```ts
it("plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers", () => {
  const source = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf-8");

  expect(source).not.toContain("buildLintCompleteFn");
  expect(source).not.toContain('import { complete } from "@mariozechner/pi-ai"');
  expect(source).not.toContain('import type { CompleteFn } from "./validation/plan-lint-model.js"');
  expect(source).not.toContain('import type { ModelRegistry } from "@mariozechner/pi-coding-agent"');
  expect(source).toContain("result = await handlePlanDraftDone(ctx.cwd);");
});
```

This keeps the existing `tests/new-session-wiring.test.ts` coverage for the session restart behavior and adds a focused regression test for the hidden T1 wiring that currently exists in `register-tools.ts`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/register-tools.test.ts -t "plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers"`
Expected: FAIL — `expect(received).not.toContain(expected)` because `extensions/megapowers/register-tools.ts` still contains `buildLintCompleteFn` and `result = await handlePlanDraftDone(ctx.cwd, completeFn);`

**Step 3 — Write minimal implementation**
In `extensions/megapowers/register-tools.ts`:

1. Remove these imports because they only support T1 wiring:

```ts
import { complete } from "@mariozechner/pi-ai";
import type { CompleteFn } from "./validation/plan-lint-model.js";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
```

2. Delete the entire helper:

```ts
async function buildLintCompleteFn(modelRegistry: ModelRegistry | undefined): Promise<CompleteFn | undefined> {
  // ...delete this whole function...
}
```

3. Update the existing `megapowers_signal` execute branch to call `handlePlanDraftDone` directly:

```ts
if (params.action === "plan_draft_done") {
  result = await handlePlanDraftDone(ctx.cwd);
} else {
  result = handleSignal(ctx.cwd, params.action, params.target);
}
```

Leave the existing `triggerNewSession` handling unchanged so `tests/new-session-wiring.test.ts` continues to pass.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/register-tools.test.ts -t "plan_draft_done wiring calls handlePlanDraftDone directly without model lint helpers"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
