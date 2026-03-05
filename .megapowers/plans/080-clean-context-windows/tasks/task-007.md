---
id: 7
title: handlePlanReview returns triggerNewSession for approve verdict
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-plan-review.ts
  - tests/tool-plan-review.test.ts
files_to_create: []
---

### Task 7: handlePlanReview returns triggerNewSession for approve verdict

**Files:**
- Modify: `extensions/megapowers/tools/tool-plan-review.ts`
- Test: `tests/tool-plan-review.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-plan-review.test.ts`, add the following test inside the `describe("handlePlanReview — approve verdict", ...)` block (after existing tests, around line 217):

```ts
  it("returns triggerNewSession on approve", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "All good.",
      approved_tasks: [1],
    });
    expect(result.error).toBeUndefined();
    expect(result.triggerNewSession).toBe(true);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts -t "returns triggerNewSession on approve"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-plan-review.ts`, modify `handleApproveVerdict` (around line 102) to add `triggerNewSession: true` to its return value.

Change from:
```ts
  return {
    message:
      `📋 Plan approved (iteration ${state.planIteration})\n` +
      `  ✅ All ${tasks.length} tasks approved\n` +
      "  → Generated plan.md for downstream consumers\n" +
      "  → Advancing to implement phase",
  };
```

To:
```ts
  return {
    message:
      `📋 Plan approved (iteration ${state.planIteration})\n` +
      `  ✅ All ${tasks.length} tasks approved\n` +
      "  → Generated plan.md for downstream consumers\n" +
      "  → Advancing to implement phase",
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-plan-review.test.ts -t "returns triggerNewSession on approve"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
