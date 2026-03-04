---
id: 13
title: Add bounded pipeline context API (V2) in new file
status: approved
depends_on: []
no_test: false
files_to_modify: []
files_to_create:
  - extensions/megapowers/subagent/pipeline-context-bounded.ts
  - tests/pipeline-context-bounded.test.ts
---

### Task 13: Add bounded pipeline context API (V2) in new file

**Files:**
- Create: `extensions/megapowers/subagent/pipeline-context-bounded.ts`
- Create: `tests/pipeline-context-bounded.test.ts`

Existing `pipeline-context.ts` and `tests/pipeline-context.test.ts` are left untouched. The new bounded API lives in a separate file. Task 14 switches the runner to import from this file.

**Step 1 — Write the failing test**

Create `tests/pipeline-context-bounded.test.ts`:

```typescript
// tests/pipeline-context-bounded.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildInitialContext,
  withRetryContext,
  renderContextPrompt,
  type BoundedPipelineContext,
} from "../extensions/megapowers/subagent/pipeline-context-bounded.js";

describe("pipeline context (bounded)", () => {
  it("builds initial context without retry data", () => {
    const ctx = buildInitialContext({
      taskDescription: "Implement parser",
      planSection: "### Task 1: Parser",
      specContent: "AC1: parse input",
      learnings: "Use bun test",
    });

    const prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("Implement parser");
    expect(prompt).toContain("### Task 1: Parser");
    expect(prompt).toContain("AC1");
    expect(prompt).toContain("Use bun test");
    expect(prompt).not.toContain("Retry");
  });

  it("withRetryContext adds bounded failure data that replaces on each call", () => {
    let ctx = buildInitialContext({ taskDescription: "x" });

    ctx = withRetryContext(ctx, {
      reason: "verify_failed",
      detail: "1 fail\nExpected true to be false at line 12",
    });

    let prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("verify_failed");
    expect(prompt).toContain("Expected true to be false");

    // Second retry REPLACES (not accumulates)
    ctx = withRetryContext(ctx, {
      reason: "review_rejected",
      detail: "Missing error handling",
    });

    prompt = renderContextPrompt(ctx);
    expect(prompt).toContain("review_rejected");
    expect(prompt).toContain("Missing error handling");
    // Old retry data is gone
    expect(prompt).not.toContain("Expected true to be false");
  });

  it("context size is O(1) — does not grow with repeated retries", () => {
    let ctx = buildInitialContext({
      taskDescription: "Implement feature",
      planSection: "### Task 1",
      specContent: "AC1: do thing",
    });

    const baseSize = renderContextPrompt(ctx).length;

    // Simulate 10 retries
    for (let i = 0; i < 10; i++) {
      ctx = withRetryContext(ctx, {
        reason: "verify_failed",
        detail: `Failure output for cycle ${i}`,
      });
    }

    const finalSize = renderContextPrompt(ctx).length;
    // Should be base + one retry section, not base + 10 retry sections
    expect(finalSize).toBeLessThan(baseSize + 500);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/pipeline-context-bounded.test.ts`
Expected: FAIL — `error: Cannot find module "../extensions/megapowers/subagent/pipeline-context-bounded.js"` (file does not exist yet).

**Step 3 — Write minimal implementation**

Create `extensions/megapowers/subagent/pipeline-context-bounded.ts`:

```typescript
// extensions/megapowers/subagent/pipeline-context-bounded.ts

export type RetryReason =
  | "implement_failed"
  | "verify_failed"
  | "review_rejected"
  | "review_failed";

export interface RetryContext {
  reason: RetryReason;
  detail: string;
}

export interface BoundedPipelineContext {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
  retryContext?: RetryContext;
}

export function buildInitialContext(input: {
  taskDescription: string;
  planSection?: string;
  specContent?: string;
  learnings?: string;
}): BoundedPipelineContext {
  return {
    taskDescription: input.taskDescription,
    planSection: input.planSection,
    specContent: input.specContent,
    learnings: input.learnings,
  };
}

export function withRetryContext(
  ctx: BoundedPipelineContext,
  retry: RetryContext,
): BoundedPipelineContext {
  return { ...ctx, retryContext: retry };
}

export function renderContextPrompt(ctx: BoundedPipelineContext): string {
  const sections: string[] = [];
  sections.push(`## Task\n\n${ctx.taskDescription}`);

  if (ctx.planSection) sections.push(`## Plan\n\n${ctx.planSection}`);
  if (ctx.specContent) sections.push(`## Spec / Acceptance Criteria\n\n${ctx.specContent}`);
  if (ctx.learnings) sections.push(`## Project Learnings\n\n${ctx.learnings}`);

  if (ctx.retryContext) {
    sections.push(
      `## Retry Context\n\nReason: ${ctx.retryContext.reason}\n\n${ctx.retryContext.detail}`,
    );
  }

  return sections.join("\n\n");
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/pipeline-context-bounded.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing — the existing `pipeline-context.ts` and `tests/pipeline-context.test.ts` are completely untouched. The new bounded API is purely additive.
