---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 4
  - 3
  - 5
  - 6
  - 7
  - 8
  - 9
approved_tasks:
  - 1
  - 2
  - 4
needs_revision_tasks:
  - 3
  - 5
  - 6
  - 7
  - 8
  - 9
---

## Per-Task Assessment

### Task 1 — ✅ PASS
Solid. Full code, correct AC coverage (AC3, AC5, AC16).

### Task 2 — ✅ PASS
Solid. Full code, correct AC coverage (AC1, AC2, AC4, AC18).

### Task 3 — ❌ REVISE
**Step 3 code is broken.** The `createMpRegistry` function listing is mangled — `registry.help = {` is missing before the `tier: "programmatic"` line. The code won't compile as written. Fix: show **only the on/off handler delta** (the two handler replacements + the `handleMegaCommand` import), not a broken full-function listing with missing lines.

### Task 4 — ✅ PASS
Solid. Full code, correct AC coverage (AC6, AC7).

### Task 5 — ❌ REVISE (merge with Task 6)
Task 5 keeps `milestone: string` (non-optional, defaulting `""`), then Task 6 changes it to `milestone?: string` (optional, `undefined`). This means Task 5's `formatIssueFile` using `issue.milestone.trim()` is throwaway code — Task 6 replaces it with `issue.milestone?.trim()`. **Merge Tasks 5 and 6 into one task** that:
1. Updates the `Store.createIssue` signature to accept both `milestone?: string` and `priority?: number`
2. Changes `Issue` interface to make both optional
3. Updates `formatIssueFile` once (with optional chaining for both)
4. Updates `listIssues`/`getIssue` defaults
5. Updates `tests/store.test.ts` assertions
6. Updates `prompt-inject.ts`
7. Single test file covering AC12-15

### Task 6 — ❌ REVISE (merge into Task 5)
See Task 5 notes. Merge into Task 5.

### Task 7 — ❌ REVISE
Two blocking issues:
1. **Step 1 missing import**: Test calls `registerTools(pi, runtimeDeps)` but never imports it. Add: `import { registerTools } from "../extensions/megapowers/register-tools.js";`
2. **Step 3 schema code incomplete**: `create-issue-schema.ts` is missing `export const CreateIssueInputSchema = z.object({` wrapper — fields appear as dangling code outside any object. Fix the code block.

### Task 8 — ❌ REVISE
Three blocking issues in Step 1:
1. Missing `import { registerTools } from "../extensions/megapowers/register-tools.js";`
2. Missing `function extractText(result: any): string {` declaration — only function body appears
3. Missing `const runtimeDeps = { store: createStore(tmp), ui: createUI() } as any;` in test body

### Task 9 — ❌ REVISE
**Step 2 is incorrect.** Task depends on `[2]`, which already adds `/mp` registration. By the time Task 9 runs, the test passes immediately — there is no RED phase. This should be marked `[no-test]` as a verification-only task, or the Step 2 should acknowledge the test already passes. No production code is written.

## Missing Coverage
None — all 19 ACs are covered.

## Summary of Required Changes
1. **Task 3**: Fix the mangled code listing — show only the on/off handler delta cleanly
2. **Tasks 5+6**: Merge into one task covering milestone + priority together (AC12-15)
3. **Task 7**: Add missing `registerTools` import to test; fix incomplete schema code block
4. **Task 8**: Add missing import, function declaration, and runtimeDeps setup to test
5. **Task 9**: Mark as `[no-test]` verification task or fix the incorrect Step 2 failure expectation
