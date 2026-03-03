---
id: 8
title: Gate revise verdict passes when revise-instructions file exists (AC5
  happy-path)
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - tests/tool-plan-review.test.ts
files_to_create: []
---

### Task 8: Gate revise verdict passes when revise-instructions file exists (AC5 happy-path) [depends: 5]

**Covers:**
- AC5 (happy-path) — When `handlePlanReview` receives `verdict: "revise"` and `revise-instructions-{planIteration}.md` exists in the plan directory, the function proceeds without error

**Files:**
- Test: `tests/tool-plan-review.test.ts`
- (No production code change needed — Task 5's `if (!existsSync(filepath))` gate already allows execution when the file is present)

**Step 1 — Write the failing test**

Add to the `"handlePlanReview — revise-instructions file gate (missing → error)"` describe block in `tests/tool-plan-review.test.ts`:

```typescript
  it("succeeds when revise-instructions file exists on revise verdict (AC5 happy-path)", () => {
    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1 });
    createTaskFile(tmp, 1, "T1");

    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "revise-instructions-1.md"), "## Task 1\nFix step 2.");

    const result = handlePlanReview(tmp, {
      verdict: "revise",
      feedback: "Task 1 needs work.",
      approved_tasks: [],
      needs_revision_tasks: [1],
    });
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("REVISE");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-plan-review.test.ts --filter "succeeds when revise-instructions file exists"`

Expected: PASS (file exists → `existsSync` returns `true` → gate allows execution → `handleReviseVerdict` returns a REVISE message with no error)

To verify the test catches regressions: remove the `writeFileSync(...)` line for `revise-instructions-1.md` and run again → Expected: FAIL — `expect(received).toBeUndefined()` where received is `"Missing revise-instructions file: ..."`. Restore the line.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/tools/tool-plan-review.ts` are needed. The gate from Task 5 correctly allows execution when the file exists.

**Step 4 — Confirm test passes**

Run: `bun test tests/tool-plan-review.test.ts --filter "succeeds when revise-instructions file exists"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
