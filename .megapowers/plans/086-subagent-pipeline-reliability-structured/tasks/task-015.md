---
id: 15
title: Add legacy deprecation comment to pipeline-context.ts
status: approved
depends_on:
  - 14
no_test: true
files_to_modify:
  - extensions/megapowers/subagent/pipeline-context.ts
files_to_create: []
---

### Task 15: Add legacy deprecation comment to pipeline-context.ts [no-test] [depends: 14]

**Justification:** Documentation-only change — adds a deprecation comment to the legacy `pipeline-context.ts` module. Task 13 created `pipeline-context-bounded.ts` and Task 14 rewired the runner to use it. The old module remains for backward compatibility and its existing tests (`tests/pipeline-context.test.ts`) continue to pass unchanged. No exports are removed.

**Files:**
- Modify: `extensions/megapowers/subagent/pipeline-context.ts`

**Step 1 — Make the change**

Add a deprecation comment at the top of `extensions/megapowers/subagent/pipeline-context.ts`:

```typescript
/**
 * @deprecated Legacy unbounded pipeline context — accumulates step outputs without size limits.
 * New code should use `pipeline-context-bounded.ts` which provides `withRetryContext()` with
 * bounded replacement semantics (AC22–AC24).
 *
 * This module is kept for backward compatibility. Do not add new callers.
 */
```

Insert this before the first `export interface PipelineStepOutput {` line. Do not modify or delete any existing exports (`PipelineStepOutput`, `PipelineContext`, `buildInitialContext`, `appendStepOutput`, `setRetryContext`, `renderContextPrompt`).

**Step 2 — Verify**
Run: `bun test tests/pipeline-context.test.ts`
Expected: all passing — no functional changes, only a comment was added.

Run: `bun test`
Expected: all passing — full suite unaffected.
