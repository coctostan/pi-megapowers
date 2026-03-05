---
id: 1
title: handleSignal returns triggerNewSession for phase_next
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/tools/tool-signal.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 1: handleSignal returns triggerNewSession for phase_next

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add the following test inside the `describe("phase_next", ...)` block (after the existing tests, around line 338):

```ts
    it("returns triggerNewSession on successful phase advance", () => {
      setState(tmp, { phase: "brainstorm" });
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBe(true);
    });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful phase advance"`

Expected: FAIL — `expect(received).toBe(expected) — Expected: true, Received: undefined`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`, modify `handlePhaseNext` (around line 249) to add `triggerNewSession: true` to the success return:

```ts
function handlePhaseNext(cwd: string, target?: string): SignalResult {
  const result = advancePhase(cwd, target as Phase | undefined);
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    message: `Phase advanced to ${result.newPhase}. Proceed with ${result.newPhase} phase work.`,
    triggerNewSession: true,
  };
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "returns triggerNewSession on successful phase advance"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
