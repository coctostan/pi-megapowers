---
id: 12
title: Standardize tests_passed feedback
status: approved
depends_on:
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `tests/tool-signal.test.ts`

Covers AC36, AC41. `tests_passed` success message starts with `✅` and states GREEN recorded.

**Step 1 — Write the failing test**

Append inside `describe("tests_passed", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("tests_passed success message starts with ✅ and records GREEN (AC36, AC41)", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const r = handleSignal(tmp, "tests_passed");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("GREEN");
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "tests_passed success message starts"`
Expected: FAIL — current message is `Tests passed (GREEN ✓).` which does not start with `✅`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the `handleTestsPassed` return (line 200):

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: "Tests passed (GREEN ✓) — recorded",
    }),
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "tests_passed"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
