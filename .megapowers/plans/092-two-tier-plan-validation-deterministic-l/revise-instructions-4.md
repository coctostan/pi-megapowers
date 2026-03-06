# Revise Instructions (Iteration 4)

## Task 1: Create LintResult type and lintTask pure function with title validation

The function signature in Task 1 uses `PlanTask` but Task 2 changes it to `LintTaskInput = PlanTask & { description: string }`. This means Task 1's tests break when Task 2 runs because `lintTask` will no longer accept a bare `PlanTask`.

**Fix:** Define `LintTaskInput` from the start in Task 1. Change the function signature to:
```typescript
export type LintTaskInput = PlanTask & { description: string };
export function lintTask(task: LintTaskInput, existingTasks: PlanTask[]): LintResult {
```

Update Task 1's `makeTask` helper to be a `makeLintTask` that includes `description: "A".repeat(200)`:
```typescript
function makeLintTask(overrides: Partial<LintTaskInput> = {}): LintTaskInput {
  return {
    id: 1,
    title: "Valid task title",
    status: "draft",
    depends_on: [],
    no_test: false,
    files_to_modify: ["extensions/megapowers/tools/tool-signal.ts"],
    files_to_create: [],
    description: "A".repeat(200),
    ...overrides,
  };
}
```

The "returns all errors" test should use `makeLintTask({ title: "", files_to_modify: [], files_to_create: [] })` so it properly includes a description.

Also: explicitly list AC3 in the "Covers" line since the files-empty check is in the implementation.

## Task 2: Add description minimum length check

Since Task 1 now defines `LintTaskInput` and `makeLintTask`, Task 2 no longer needs to introduce these types. Task 2 should simply add the description length check to the existing `lintTask` function and add new tests — no type changes needed.

Remove the `LintTaskInput` type definition from Task 2's Step 3 (it's now in Task 1). The Step 3 implementation just adds the description check inside `lintTask`:
```typescript
  if (task.description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${task.description.length}).`);
  }
```

Remove the note about "update existing tests to use `makeLintTask`" since they already use it from Task 1.

## Task 5: Integrate lintTask into handlePlanTask

Step 3 shows a new import line `import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js"` but `readPlanTask` and `writePlanTask` are already imported on line 2 of `tool-plan-task.ts`. 

**Fix:** Show this as updating the existing import:
```typescript
// BEFORE (line 2):
import { readPlanTask, writePlanTask } from "../state/plan-store.js";
// AFTER:
import { readPlanTask, writePlanTask, listPlanTasks } from "../state/plan-store.js";
```

## Task 11: Wire async handlePlanDraftDone in register-tools.ts

Three issues:

### 1. Wrong import path (Critical)
`"@mariozechner/pi-ai/stream.js"` does NOT resolve. The package has no subpath exports — the file is at `dist/stream.js`. 

**Fix:** Change to:
```typescript
import { complete } from "@mariozechner/pi-ai/dist/stream.js";
```

Verified: `import('@mariozechner/pi-ai/dist/stream.js')` succeeds, `import('@mariozechner/pi-ai/stream.js')` throws `Cannot find module`.

### 2. Source-code assertion test is not a real test
The test reads `register-tools.ts` as a string and checks for substrings. This is extremely brittle and doesn't test behavior. If someone renames a variable or reformats, the test breaks. If the wiring is wrong but the strings happen to match, the test passes.

**Fix:** Either:
- (Preferred) Mark Task 11 as `[no-test]` with justification: "Integration wiring — behavioral correctness is verified by Task 9 and Task 10's async `handlePlanDraftDone` tests. The wiring in register-tools.ts is a thin adapter that passes `completeFn` through. Type-checking provides compile-time verification." Add a verification step: `bun typecheck` or `bun test` to confirm no type errors.
- Or write a proper integration test that mocks `modelRegistry` on the `ctx` object, but this would require importing and invoking the registered tool's execute function, which is complex and adds little value over Task 9/10.

### 3. Update source assertions if keeping the test
If you keep the source assertion approach (not recommended), update ALL string checks to use the corrected import path:
```typescript
expect(source).toContain('from "@mariozechner/pi-ai/dist/stream.js"');
```
