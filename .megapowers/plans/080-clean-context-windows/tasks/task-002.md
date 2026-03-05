---
id: 2
title: handleSignal returns triggerNewSession for phase_back
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 2: handleSignal returns triggerNewSession for phase_back

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("phase_back", ...)` block (after the existing happy-path tests, around line 382):

```ts
    it("returns triggerNewSession on successful backward transition", () => {
      setState(tmp, { phase: "verify" });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful backward transition"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify `handlePhaseBack` (around line 263) to add `triggerNewSession: true` to the success return:

Change the return at the end of `handlePhaseBack` from:
```ts
  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
  };
```

To:
```ts
  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
    triggerNewSession: true,
  };
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful backward transition"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
