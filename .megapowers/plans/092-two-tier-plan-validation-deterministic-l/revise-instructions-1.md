## Task 2: Add description minimum length check to lintTask

Your current Task 2 changes `lintTask` to a 3-argument signature (`lintTask(task, existingTasks, description)`), but AC8 explicitly requires a pure function with signature shape `lintTask(task, existingTasks)`.

### What to change

1. Keep `lintTask` at **2 parameters**.
2. Include description in the `task` input type instead of a third argument.

Use this pattern:

```ts
// extensions/megapowers/validation/plan-task-linter.ts
import type { PlanTask } from "../state/plan-schemas.js";

export type LintTaskInput = PlanTask & { description: string };
export type LintResult = { pass: true } | { pass: false; errors: string[] };

const MIN_DESCRIPTION_LENGTH = 200;

export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
  const errors: string[] = [];

  if (!task.title || task.title.trim().length === 0) {
    errors.push("Title must not be empty or whitespace-only.");
  }

  if (task.description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
  }

  if (task.files_to_modify.length === 0 && task.files_to_create.length === 0) {
    errors.push("Task must specify at least one file in files_to_modify or files_to_create.");
  }

  return errors.length > 0 ? { pass: false, errors } : { pass: true };
}
```

### Test corrections

- Replace `lintTask(makeTask(), [], "...")` calls with `lintTask(makeLintTask({ description: "..." }), [])`.
- Remove vague Step 2 wording (`or similar type error`) and specify one exact failure expectation.

---

## Task 3: Add depends_on validation to lintTask

This task currently assumes the 3-argument lint signature from Task 2.

### What to change

- Update tests and examples to call the 2-arg signature only.
- Build the task input with a `description` field in the task object.

Example:

```ts
const task = makeLintTask({ id: 3, depends_on: [99], description: "A".repeat(200) });
const result = lintTask(task, existingTasks);
```

Keep the dependency logic itself (ID existence + no forward references), but ensure it works with the corrected signature.

---

## Task 4: Add duplicate files_to_create cross-task check to lintTask

Same signature issue as Task 3.

### What to change

- Update all test and implementation snippets to the 2-arg `lintTask(task, existingTasks)` form.
- Keep the self-update skip (`if (existing.id === task.id) continue;`) as-is.

---

## Task 5: Integrate lintTask into handlePlanTask

Your integration snippet currently calls `lintTask(task, existingTasks, params.description)`, which won’t match AC8 once corrected.

### What to change

Use the actual `tool-plan-task.ts` and `state/plan-store.ts` APIs, but pass description by augmenting the task object:

```ts
// create path
const lintInput = { ...task, description: params.description };
const existingTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
const lintResult = lintTask(lintInput, existingTasks);
```

```ts
// update path
const body = params.description ?? existing.content;
const lintInput = { ...merged, description: body };
const allTasks = listPlanTasks(cwd, slug).map((doc) => doc.data);
const lintResult = lintTask(lintInput, allTasks);
```

Also keep error aggregation formatting so all lint errors are returned together.

---

## Task 9: Make handlePlanDraftDone async with T1 lint integration

This task has two correctness gaps:

1. The Step 1 test block uses `tmp` but does not show setup/teardown in the snippet.
2. The implementation only reads `spec.md` directly, which misses bugfix workflow criteria handling.

### What to change

#### A) Fix test setup completeness
Include `let tmp`, `beforeEach`, `afterEach` in the snippet (same style already used in `tests/tool-signal.test.ts`).

#### B) Use existing derived criteria API for feature + bugfix support
Use `deriveAcceptanceCriteria` from `extensions/megapowers/state/derived.ts` instead of hardcoding `spec.md` reads:

```ts
import { deriveAcceptanceCriteria } from "../state/derived.js";

const criteria = deriveAcceptanceCriteria(cwd, state.activeIssue!, state.workflow!);
const criteriaText = criteria.map(c => `${c.id}. ${c.text}`).join("\n");
```

Pass `criteriaText` into `lintPlanWithModel(...)` so T1 always sees active acceptance criteria, including bugfix diagnosis/fixed-when criteria.

---

## Task 10: Add graceful degradation when T1 API key is unavailable

Current plan does not fully satisfy AC16 and has a broken assertion.

### What to change

1. When `completeFn` is undefined, include an explicit warning in success message (not just silent skip).
2. Fix malformed-response assertion syntax (`expect(...) || expect(...)` is invalid test logic).

Use explicit assertions:

```ts
expect(result.message).toContain("⚠️");
expect(result.message).toContain("skipped");
```

And for malformed fail-open:

```ts
expect(result.message).toContain("malformed");
```

Implementation should append warning text in both cases:
- no completeFn available (no API key)
- malformed model response (from `lintPlanWithModel` warning)

---

## Task 11: Wire async handlePlanDraftDone with real completeFn in register-tools.ts

This task currently violates AC12 and has an unstable RED step.

### What to change

#### A) Use `complete()` (not `completeSimple()`)
AC12 requires `@mariozechner/pi-ai` `complete()` with thinking disabled path.

Use:

```ts
import { complete } from "@mariozechner/pi-ai/stream.js";
```

Then build `completeFn` like:

```ts
const response = await complete(model, {
  messages: [{
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
  }],
}, { apiKey });

return response.content
  .filter((c): c is { type: "text"; text: string } => c.type === "text")
  .map(c => c.text)
  .join("\n");
```

#### B) Use model IDs that actually exist in this codebase
`ctx.modelRegistry.find(provider, modelId)` is safer than hardcoded `getModel(...)` with an invalid ID.

Use registry lookups, e.g.:

```ts
const model =
  ctx.modelRegistry.find("anthropic", "claude-haiku-4-5") ??
  ctx.modelRegistry.find("anthropic", "claude-3-5-haiku-latest") ??
  ctx.model;
```

Then resolve API key with the existing signature:

```ts
const apiKey = model ? await ctx.modelRegistry.getApiKey(model) : undefined;
```

#### C) Make RED test deterministic
Your current RED test (`handleSignal returns Promise`) may already pass after Task 9 depending on implementation order. Use a deterministic check around `register-tools.ts` wiring instead (e.g., assert awaited call path), or assert behavior that is definitely absent before Task 11 and present after Task 11.
