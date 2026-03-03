---
id: 7
title: Guard vars.revise_instructions behind planMode check — draft mode does
  not read (AC3)
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 7: Guard vars.revise_instructions behind planMode check — draft mode does not read (AC3) [depends: 4]

**Covers:**
- AC3 — When `planMode` is `"draft"`, `vars.revise_instructions` is not populated, and `store.readPlanFile` is never called for revise-instructions files

**Files:**
- Test: `tests/prompt-inject.test.ts`
- (No production code change needed — the `if (state.planMode === "revise" && store)` guard from Task 4 already handles this; this task adds the regression test to catch any future removal of that guard)

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts`:

```typescript
  it("does not read revise-instructions-* files when planMode is draft (AC3)", () => {
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    const store = createStore(tmp);

    const calls: string[] = [];
    const originalReadPlanFile = store.readPlanFile.bind(store);
    (store as any).readPlanFile = (slug: string, filename: string) => {
      calls.push(filename);
      return originalReadPlanFile(slug, filename);
    };

    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    expect(calls.some(f => f.startsWith("revise-instructions-"))).toBe(false);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "does not read revise-instructions"`

Expected: PASS (the `if (state.planMode === "revise" && store)` guard from Task 4 already prevents revise-instructions reads in draft mode — this test is a regression guard)

To verify the test actively catches regressions: temporarily remove the `state.planMode === "revise" &&` condition from the Task 4/6 block, run again → Expected: FAIL — `expect(received).toBe(false)` where received is `true` (because `calls` now contains `"revise-instructions-0.md"`). Restore the guard.

**Step 3 — No production code changes**

No changes to `extensions/megapowers/prompt-inject.ts` are needed. The `if (state.planMode === "revise" && store)` guard from Tasks 4/6 correctly prevents revise-instructions reads when `planMode` is `"draft"`.

**Step 4 — Confirm test passes**

Run: `bun test tests/prompt-inject.test.ts --filter "does not read revise-instructions"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
