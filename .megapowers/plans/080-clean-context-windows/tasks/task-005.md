---
id: 5
title: handleSignal does NOT return triggerNewSession on error results
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: false
files_to_modify:
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 5: handleSignal does NOT return triggerNewSession on error results [depends: 1, 2, 3, 4]

**Files:**
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add a new describe block after the existing `describe("invalid action", ...)` block:

```ts
  describe("triggerNewSession — error cases", () => {
    it("does NOT return triggerNewSession when phase_next fails", () => {
      setState(tmp, { phase: "spec" }); // spec.md missing — gate will fail
      const result = handleSignal(tmp, "phase_next");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when phase_back fails", () => {
      setState(tmp, { phase: "brainstorm" }); // no backward transition
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when task_done fails", () => {
      setState(tmp, {
        phase: "implement",
        currentTaskIndex: 0,
        completedTasks: [],
        tddTaskState: null, // Will fail TDD check
      });
      writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: Build\n");
      const result = handleSignal(tmp, "task_done");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession when plan_draft_done fails", () => {
      setState(tmp, { phase: "implement", planMode: null });
      const result = handleSignal(tmp, "plan_draft_done");
      expect(result.error).toBeDefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — error cases"`

Expected: PASS — These tests should already pass since error paths return `{ error: ... }` without `triggerNewSession`. This is a verification-only test confirming AC8.

Note: Since this is verifying existing correct behavior (error paths don't set triggerNewSession), these tests should pass immediately after Tasks 1-4 are implemented. They exist to guard against regressions.

**Step 3 — Write minimal implementation**

No implementation changes needed — error paths already return `{ error: ... }` without `triggerNewSession`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — error cases"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
