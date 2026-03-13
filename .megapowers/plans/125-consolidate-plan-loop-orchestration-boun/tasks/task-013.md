---
id: 13
title: Remove review_approve instruction text from tool instructions
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/workflows/tool-instructions.ts
  - tests/workflow-configs.test.ts
files_to_create: []
---

### Task 13: Remove review_approve instruction text from tool instructions

**Files:**
- Modify: `extensions/megapowers/workflows/tool-instructions.ts`
- Test: `tests/workflow-configs.test.ts`

**Step 1 — Write the failing test**
Add this source-level regression test to `tests/workflow-configs.test.ts` inside the `deriveToolInstructions` describe block:

```ts
it("tool-instructions source no longer contains needsReviewApproval or review_approve guidance", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "extensions/megapowers/workflows/tool-instructions.ts"),
    "utf-8",
  );

  expect(source).not.toContain("needsReviewApproval");
  expect(source).not.toContain("review_approve");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/workflow-configs.test.ts`
Expected: FAIL — `expect(received).not.toContain("needsReviewApproval")`

**Step 3 — Write minimal implementation**
Remove the dead review-approval branch from `extensions/megapowers/workflows/tool-instructions.ts`:

```ts
  // delete this entire block
  if (phase.needsReviewApproval) {
    parts.push(
      `If the plan is acceptable, call \`megapowers_signal\` with action \`"review_approve"\` to approve it.`,
      `Then call \`megapowers_signal\` with action \`"phase_next"\` to advance to implement.`,
      `If changes are needed, explain what to fix. The user will revise and re-submit.`,
    );
    return parts.join("\n");
  }
```

After this deletion, review-mode guidance comes only from the dedicated `review-plan.md` prompt and the `megapowers_plan_review` tool, while artifact phases and TDD phases keep their current instruction text.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/workflow-configs.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
