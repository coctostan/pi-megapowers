---
id: 1
title: Delete T1 dead files and remove orphaned test block
status: approved
depends_on: []
no_test: false
files_to_modify:
  - tests/tool-signal.test.ts
files_to_create: []
---

**Files:**
- Delete: `extensions/megapowers/validation/plan-lint-model.ts`
- Delete: `prompts/lint-plan-prompt.md`
- Delete: `tests/plan-lint-model.test.ts`
- Modify: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add a structural verification test to `tests/tool-signal.test.ts` that asserts the T1 dead code is gone. Add this at the end of the outer `describe("handleSignal", ...)` block (before the closing `});` on line 863):

```typescript
  describe("T1 dead code removal verification", () => {
    it("plan-lint-model.ts does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "extensions/megapowers/validation/plan-lint-model.ts"), "utf-8")
      ).toThrow();
    });

    it("lint-plan-prompt.md does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "prompts/lint-plan-prompt.md"), "utf-8")
      ).toThrow();
    });

    it("plan-lint-model.test.ts does not exist", () => {
      expect(() =>
        readFileSync(join(process.cwd(), "tests/plan-lint-model.test.ts"), "utf-8")
      ).toThrow();
    });

    it("no runtime imports reference plan-lint-model", () => {
      const extensionsDir = join(process.cwd(), "extensions");
      const { execSync } = require("child_process");
      const result = execSync(
        `grep -rn "from.*plan-lint-model" "${extensionsDir}" --include="*.ts" || true`,
        { encoding: "utf-8" }
      );
      expect(result.trim()).toBe("");
    });
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts`
Expected: FAIL — The first 3 tests fail because the files still exist (readFileSync succeeds instead of throwing). The T1 orphaned test block at lines 865-905 also still passes (exercising dead behavior).

**Step 3 — Write minimal implementation**

1. Delete the three dead files:
```bash
rm extensions/megapowers/validation/plan-lint-model.ts
rm prompts/lint-plan-prompt.md
rm tests/plan-lint-model.test.ts
```

2. Remove the orphaned `describe("handlePlanDraftDone — no T1 model gating", ...)` block (lines 865-905) from `tests/tool-signal.test.ts`. This block starts after the outer `describe("handleSignal", ...)` closing `});` and contains a single test that passes a `failFn` via `(handlePlanDraftDone as any)(tmp2, failFn)` — a parameter that `handlePlanDraftDone` no longer accepts.

The final `tests/tool-signal.test.ts` should end with:

```typescript
  // ... (end of "triggerNewSession — non-transition actions" describe block)
  });
});
// (EOF — the "handlePlanDraftDone — no T1 model gating" block is removed)
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts`
Expected: PASS — All structural verification tests pass (files don't exist, no imports reference them). The orphaned T1 test block is gone. Existing `plan_draft_done` tests (lines 266-331) still cover all paths.

**Step 5 — Verify no regressions**

Run: `bun test`
Expected: All passing. Test count drops by 9 (8 from deleted `plan-lint-model.test.ts` + 1 from the removed orphaned block) but gains 4 new verification tests, net change: -5 tests.
