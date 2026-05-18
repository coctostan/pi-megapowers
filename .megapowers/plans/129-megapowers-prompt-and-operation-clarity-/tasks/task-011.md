---
id: 11
title: Standardize tests_failed feedback
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

Covers AC36, AC40. `tests_failed` success message must start with a vocabulary icon (`✅`), state that RED is recorded, and state that production writes are now allowed.

**Step 1 — Write the failing test**

Append inside `describe("tests_failed", ...)` in `tests/tool-signal.test.ts`:

```ts
    it("tests_failed success message starts with ✅ and states RED recorded + writes unlocked (AC36, AC40)", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const r = handleSignal(tmp, "tests_failed");
      expect(r.error).toBeUndefined();
      expect(r.message!.startsWith("✅")).toBe(true);
      expect(r.message).toContain("RED");
      expect(r.message!.toLowerCase()).toContain("production");
      expect(r.message!.toLowerCase()).toMatch(/writes? .* allowed|allowed/);
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts -t "tests_failed success message starts"`
Expected: FAIL — current message is `Tests failed (RED ✓). Production code writes are now allowed.` (already mentions RED and production writes, but does NOT start with `✅`). The `startsWith("✅")` assertion fails.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, replace the `handleTestsFailed` final return (line 186):

```ts
  return {
    message: composeMessage({
      icon: "success",
      summary: "Tests failed (RED ✓) — recorded",
      nextStep: "Production code writes are now allowed.",
    }),
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts -t "tests_failed"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
