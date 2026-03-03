---
type: plan-review
iteration: 1
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 4
  - 9
  - 3
  - 5
  - 6
  - 7
  - 8
approved_tasks:
  - 1
  - 2
  - 4
  - 9
needs_revision_tasks:
  - 3
  - 5
  - 6
  - 7
  - 8
---

## Per-Task Assessment

### Task 1 — ✅ PASS
### Task 2 — ✅ PASS
### Task 4 — ✅ PASS
### Task 9 — ✅ PASS

### Task 3 — ❌ REVISE
- Step 3 uses `...existing exports unchanged...` and `...stub handlers unchanged...` placeholders. Show the complete `createMpRegistry` function body so a developer can implement without guessing.
- The new `import { handleMegaCommand } from "../commands.js"` needs to be shown as an explicit addition to the imports from Task 1.

### Task 5 — ❌ REVISE
- Step 3 shows fragments of `formatIssueFile` but not the complete updated function. The existing function uses a template literal — show the full replacement.
- Step 3 point 5 about `listIssues`/`getIssue` normalization is confusing since it's deferred to Task 6. Remove or clarify.
- Step 3 point 6 about updating `tests/store.test.ts` is too vague. If existing tests break due to the signature change (5th param added), specify exactly which assertions change and how.

### Task 6 — ❌ REVISE
- Same issue: show the complete updated `formatIssueFile` function with both milestone and priority lines.
- Step 3 point 7 says "Update the one store test" but doesn't specify the file path, test name, or exact old→new assertion. Be explicit.
- Step 3 point 8 modifies `prompt-inject.ts` but doesn't show current code or exact location. Show the old line and the new line.
- `files_to_modify` lists `tests/store.test.ts` but the "Files:" header in the description omits it.

### Task 7 — ❌ REVISE
- The test uses `registerTools(pi, {} as any)` — `runtimeDeps` is empty. When `execute()` calls `ensureDeps(runtimeDeps, pi, ctx.cwd)`, this may throw before validation runs if `ensureDeps` validates the deps object eagerly. Verify this works or provide a proper `runtimeDeps` mock with `execGit` and `execCmd`.
- Better approach: test `createIssueHandler(store, params)` directly for validation logic (it's a pure function), and test registration separately with a simpler assertion.

### Task 8 — ❌ REVISE  
- **Blocking bug**: Test calls `registerTools(pi, {} as any)` then invokes the success path which WILL call `ensureDeps(runtimeDeps, pi, ctx.cwd)` → `createStore(cwd)`. With `runtimeDeps = {}`, `ensureDeps` may throw. The test must either:
  (a) Mock `runtimeDeps` properly: `{ execGit: async () => ..., execCmd: async () => ... }`, or
  (b) Test `createIssueHandler(createStore(tmp), validParams)` directly (preferred — it's already a pure function).
- Step 3 implementation is identical to Task 7. Acknowledge this is a test-only task with "No production code changes needed" rather than showing duplicate code.

## Missing Coverage (minor)
- No test explicitly checks handler `tier` values (AC5) — acceptable since TypeScript enforces the type.
- No test for invalid `sources` input to `create_issue` — acceptable since Zod handles it and the schema is tested implicitly.

## Summary
The main structural issue is Tasks 7-8 test approach — testing through `registerTools` with an empty `runtimeDeps` mock will break on the success path. Either test `createIssueHandler` directly (cleaner) or provide proper mocks. Tasks 3/5/6 need complete code instead of fragment placeholders.
