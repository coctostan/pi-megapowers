# Revise Instructions — Iteration 2

## Task 3: Add depends_on validation to lintTask

**Bug: Check order causes test failure.** For `depId=99` with `task.id=3`, the condition `depId >= task.id` (99 >= 3) is true, so the code produces `"forward reference to task 99"` — but the test expects `"non-existent task 99"`.

Fix the implementation order. Check non-existent first for IDs that are NOT in existingIds, then check forward reference separately:

```typescript
for (const depId of task.depends_on) {
  if (depId >= task.id) {
    errors.push(`depends_on contains forward reference to task ${depId} (current task is ${task.id}).`);
  } else if (!existingIds.has(depId)) {
    errors.push(`depends_on references non-existent task ${depId}.`);
  }
}
```

The issue is that `99` is both a forward reference AND non-existent. The test expects the "non-existent" message. Either:
- (A) Change the test to expect the forward reference error for depId=99 (since 99 >= 3 IS a forward reference), OR
- (B) Restructure so depIds >= task.id get "forward reference" and depIds < task.id but not in existingIds get "non-existent". Then change the test: use depId=99 → expect forward reference, and add a separate test with depId=1 where task 1 doesn't exist in existingTasks → expect non-existent.

Option (B) is cleaner. The current logic is correct for the implementation, but the **test** is wrong. Fix the test:
- `depends_on: [99]` with task id 3 → expect `"forward reference to task 99"`
- Add new test: `depends_on: [1]` with existingTasks=[] (empty) → expect `"non-existent task 1"`

## Task 5: Integrate lintTask into handlePlanTask

**TypeScript type narrowing for `params.description`:** After the early return on line 51-53, `params.description` is known to be defined, but TypeScript can't narrow through the spread. Use non-null assertion:

For the **create path**:
```typescript
const lintInput = { ...task, description: params.description! };
```

For the **update path**, `body` is already `string` (from `params.description ?? existing.content`), so:
```typescript
const lintInput = { ...merged, description: body };
```
This is already correct.

Also explicitly show the updated import line:
```typescript
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
```

## Task 9: Make handlePlanDraftDone async with T1 lint integration

**Critical: handleSignal sync/async breakage.** Making `handlePlanDraftDone` async means the `case "plan_draft_done"` in `handleSignal`'s switch returns a `Promise<SignalResult>` instead of `SignalResult`. This breaks:
1. The return type of `handleSignal` (currently `SignalResult`)
2. All existing tests that call `handleSignal(cwd, "plan_draft_done")` synchronously

Since Task 11 intercepts `plan_draft_done` in register-tools.ts BEFORE calling `handleSignal`, the cleanest fix is:

**Remove the `plan_draft_done` case from `handleSignal`'s switch statement.** Add it to the `default` case with an error like `"plan_draft_done must be handled by the tool registration layer."` — or simply let it fall through to the default `Unknown signal action` error.

Then export `handlePlanDraftDone` as a standalone async function (not called through `handleSignal`).

Update existing tests: any test that calls `handleSignal(cwd, "plan_draft_done")` should be changed to call `handlePlanDraftDone(cwd, ...)` directly. Check the existing test file for such tests and migrate them.

The implementation in Step 3 should show:
1. The removed/updated switch case
2. The exported async function with full signature
3. Updated existing tests (if any call handleSignal with plan_draft_done)

## Task 10: Add graceful degradation when T1 API key is unavailable

**Scoping issue:** The Step 3 fragment shows the `if (!completeFn) / else` structure but doesn't show where `criteriaText` and `taskSummaries` are computed. In Task 9, these are inside the `if (completeFn)` block. Task 10 restructures this but the fragment is incomplete.

Show the complete function body (or at least the full block from task list loading through the return), making clear that `criteria` and `taskSummaries` computation moves BEFORE the `if/else` or INSIDE the `else` block:

```typescript
export async function handlePlanDraftDone(cwd: string, completeFn?: CompleteFn): Promise<SignalResult> {
  // ... state checks, task loading ...
  
  let lintWarning = "";
  if (!completeFn) {
    lintWarning = "\n  ⚠️ T1 lint skipped: no model API key available.";
  } else {
    const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
    const criteriaText = criteria.map((c) => `${c.id}. ${c.text}`).join("\n");
    const taskSummaries = tasks.map((t) => ({
      id: t.data.id,
      title: t.data.title,
      description: t.content,
      files: [...t.data.files_to_modify, ...t.data.files_to_create],
    }));
    
    const lintResult = await lintPlanWithModel(taskSummaries, criteriaText, completeFn);
    if (!lintResult.pass) {
      return { error: `❌ T1 plan lint failed:\n${lintResult.errors.map((e) => `  • ${e}`).join("\n")}` };
    }
    if (lintResult.warning) {
      lintWarning = `\n  ⚠️ ${lintResult.warning}`;
    }
  }
  
  writeState(cwd, { ...state, planMode: "review" });
  return { message: `📝 Draft complete...${lintWarning}`, triggerNewSession: true };
}
```

## Task 11: Wire async handlePlanDraftDone with real completeFn in register-tools.ts

**1. Remove `thinkingEnabled: false`.** This is NOT a valid `ProviderStreamOptions` field. `StreamOptions` has `temperature`, `maxTokens`, `signal`, `apiKey`, `transport`, `cacheRetention`, `sessionId`, `onPayload`, `headers` — no `thinkingEnabled`. Haiku 4.5 doesn't use thinking by default, so simply omit the option:

```typescript
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
```

Update the source-level test assertion to remove the `thinkingEnabled` check.

**2. Remove `ctx.model` as fallback.** Using the main conversation model (potentially Sonnet/Opus) for a "fast lint" defeats the purpose. If haiku isn't found, return `undefined` (T1 skipped with warning — handled by Task 10):

```typescript
async function buildLintCompleteFn(ctx: any): Promise<CompleteFn | undefined> {
  const model =
    ctx.modelRegistry.find("anthropic", "claude-haiku-4-5") ??
    ctx.modelRegistry.find("anthropic", "claude-3-5-haiku-latest");
  if (!model) return undefined;
  const apiKey = await ctx.modelRegistry.getApiKey(model);
  if (!apiKey) return undefined;
  // ... build completeFn
}
```

Update the test assertion to not check for `ctx.model` fallback.

**3. Source-level test brittleness.** The exact-string matching (e.g., `expect(source).toContain("const completeFn = await buildLintCompleteFn(ctx);")`) will break on any formatting change. Consider checking for key semantic markers instead of exact statements:
- Check the function/import exists: `expect(source).toContain("buildLintCompleteFn")`
- Check it uses `complete` from pi-ai: `expect(source).toContain("from \"@mariozechner/pi-ai/stream.js\"")`
- Check it calls `modelRegistry.find`: `expect(source).toContain("modelRegistry.find")`
- Check it calls `getApiKey`: `expect(source).toContain("getApiKey")`

This is still source-level but less brittle.
