---
id: 9
title: Use orchestrator focused-review decisions in hooks
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
  - tests/hooks-focused-review.test.ts
files_to_create: []
---

### Task 9: Use orchestrator focused-review decisions in hooks [depends: 1]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-focused-review.test.ts`

**Step 1 — Write the failing test**
Add these two tests to `tests/hooks-focused-review.test.ts`:

```ts
it("does not invoke focused review fan-out when planMode is draft even with five or more tasks", async () => {
  setState(tmp, { phase: "plan", planMode: "draft" });
  createTaskFiles(tmp, 6);

  let called = 0;
  await preparePlanReviewContext(tmp, async () => {
    called += 1;
    return {
      ran: true,
      runtime: "pi-subagents",
      mode: "parallel",
      availableArtifacts: [],
      unavailableArtifacts: [],
      message: "should not run",
    };
  });

  expect(called).toBe(0);
});

it("hooks.ts uses shouldRunFocusedReview from plan-orchestrator", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/hooks.ts"),
    "utf-8",
  );

  expect(source).toContain('from "./plan-orchestrator.js"');
  expect(source).toContain("shouldRunFocusedReview(state.planMode, taskCount)");
  expect(source).not.toContain("shouldRunFocusedReviewFanout(taskCount)");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: FAIL — `expect(received).toContain("shouldRunFocusedReview(state.planMode, taskCount)")`

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/hooks.ts`:

```ts
import { shouldRunFocusedReview } from "./plan-orchestrator.js";
```

Then change the decision block in `preparePlanReviewContext` to:

```ts
  const taskCount = deriveTasks(cwd, state.activeIssue).length;
  if (!shouldRunFocusedReview(state.planMode, taskCount)) return;
```

Keep the fan-out execution itself exactly where it is: still call `runFocusedReviewFanoutFn(...)`, still soft-fail on thrown errors, and still pass the same `cwd`, `issueSlug`, `workflow`, and `taskCount` payload.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
