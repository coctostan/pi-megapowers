# Revise Instructions — Iteration 3

## Task 9: Make handlePlanDraftDone async with T1 lint integration

### Problem: Breaking existing tests without migration code

Step 3 says "Remove the `plan_draft_done` case from `handleSignal`'s switch" and vaguely mentions "Update existing tests that previously called `handleSignal(cwd, "plan_draft_done")`." But there are **~10 existing tests** in `tests/tool-signal.test.ts` (lines 266-331, plus line 824) that call `handleSignal(tmp, "plan_draft_done")` and will break with `Unknown signal action: plan_draft_done`.

**Fix:** Step 3 must include explicit migration code. Add a subsection "Migrate existing plan_draft_done tests" with:

1. List the specific test cases that need updating (the `describe("plan_draft_done signal", ...)` block and the `triggerNewSession` test).
2. Show the migration pattern:

```typescript
// BEFORE (sync, via handleSignal):
const result = handleSignal(tmp, "plan_draft_done");

// AFTER (async, direct call — no completeFn for existing tests):
const result = await handlePlanDraftDone(tmp);
```

3. Since these tests become async, wrap them with `async () =>`:

```typescript
it("transitions planMode from draft to review", async () => {
  // ... setup ...
  const result = await handlePlanDraftDone(tmp);
  // ... assertions unchanged ...
});
```

4. The import line in the test file needs updating too:

```typescript
// BEFORE:
import { handleSignal } from "../extensions/megapowers/tools/tool-signal.js";

// AFTER (add handlePlanDraftDone):
import { handleSignal, handlePlanDraftDone } from "../extensions/megapowers/tools/tool-signal.js";
```

5. **Do NOT remove `"plan_draft_done"` from the `handleSignal` action type union** — keep it in the type but remove the switch case. This way, if `handleSignal` is called with `"plan_draft_done"` it returns the `default` error, which is correct since callers should use `handlePlanDraftDone` directly.

### Also: Step 2 expected failure needs to be more specific

Step 2 says `No matching export in ".../tool-signal.ts" for import "handlePlanDraftDone"`. This is wrong — the **existing** `handlePlanDraftDone` is a private function (not exported). The import will fail with a module resolution error. Update:

```
Expected: FAIL — `handlePlanDraftDone` is not exported from tool-signal.ts (it exists as a private function).
```

## Task 11: Wire async handlePlanDraftDone with real completeFn in register-tools.ts

### Problem: String-matching tests are fragile and incomplete

The source-code-scanning approach (`readFileSync` + `toContain`) tests that specific strings appear in the source code but doesn't verify behavior. This is acceptable for wiring code that's hard to test in isolation, but the tests need refinement:

1. **Remove the `completeSimple` negative check** — it's over-constraining. If the implementation later uses `completeSimple` for a valid reason (e.g., simpler API), the test would fail for no good reason. Keep only the positive assertions.

2. **Remove the `?? ctx.model` negative check** for the same reason — over-constraining implementation details.

3. **The `buildLintCompleteFn` helper takes `ctx: any`** — this should be typed. Use the actual context type from the execute handler, or at minimum:

```typescript
async function buildLintCompleteFn(ctx: { modelRegistry: ModelRegistry }): Promise<CompleteFn | undefined> {
```

Show this in Step 3.

4. **Step 2 expected failure** says `Expected to contain: 'from "@mariozechner/pi-ai/stream.js"'` — but there might already be imports from pi-ai in the file. Check the actual current imports. Currently `register-tools.ts` imports `StringEnum` from `@mariozechner/pi-ai` (line 5). The new import is from `@mariozechner/pi-ai/stream.js` which is a different subpath. So the expected failure is correct.
