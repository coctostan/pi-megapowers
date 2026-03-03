---
id: 9
title: Approve verdict does not check for revise-instructions file (AC7)
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - tests/tool-plan-review.test.ts
files_to_create: []
---

### Task 9: Approve verdict does not check for revise-instructions file (AC7) [depends: 5]

**Covers:**
- AC7 — When `handlePlanReview` receives `verdict: "approve"`, no revise-instructions file check is performed

**Files:**
- Test: `tests/tool-plan-review.test.ts`
- (No production code change needed — the gate from Task 5 is inside `if (params.verdict === "revise")`, so approve verdicts bypass it entirely)

**Step 1 — Write the failing test**

Add to the `"handlePlanReview — revise-instructions file gate (missing → error)"` describe block in `tests/tool-plan-review.test.ts`:

```typescript
  it("does not check for revise-instructions file on approve verdict (AC7)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");
    // No revise-instructions-1.md written — if the gate ran on approve, this would return an error

    const result = handlePlanReview(tmp, {
      verdict: "approve",
      feedback: "Looks great.",
      approved_tasks: [1],
      needs_revision_tasks: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("approved");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts --filter "does not check for revise-instructions file on approve"`

Expected: PASS (`params.verdict === "revise"` is `false` for approve → gate is skipped → `handleApproveVerdict` runs normally and returns a success message)

To verify the test catches regressions: change the gate condition in Task 5's implementation to `if (params.verdict !== "")` (making it run for all verdicts), run again → Expected: FAIL — `expect(received).toBeUndefined()` where received contains `"Missing revise-instructions file: ..."`. Restore the condition.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/tools/tool-plan-review.ts` are needed. The `if (params.verdict === "revise")` guard from Task 5 correctly restricts the file check to revise verdicts only.

**Step 4 — Confirm test passes**

Run: `bun test tests/tool-plan-review.test.ts --filter "does not check for revise-instructions file on approve"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
