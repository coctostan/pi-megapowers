---
id: 6
title: handleSignal does NOT return triggerNewSession for non-transition actions
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

### Task 6: handleSignal does NOT return triggerNewSession for non-transition actions [depends: 1, 2, 3, 4]

**Files:**
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

In `tests/tool-signal.test.ts`, add a new describe block:

```ts
  describe("triggerNewSession — non-transition actions", () => {
    it("does NOT return triggerNewSession for tests_failed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_failed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for tests_passed", () => {
      setState(tmp, {
        phase: "implement",
        tddTaskState: { taskIndex: 1, state: "test-written", skipped: false },
      });
      const result = handleSignal(tmp, "tests_passed");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });

    it("does NOT return triggerNewSession for close_issue", () => {
      const issuesDir = join(tmp, ".megapowers", "issues");
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(
        join(issuesDir, "001-test.md"),
        "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Test\nDesc",
      );
      setState(tmp, { phase: "done" });
      const result = handleSignal(tmp, "close_issue");
      expect(result.error).toBeUndefined();
      expect(result.triggerNewSession).toBeUndefined();
    });
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — non-transition actions"`

Expected: PASS — These tests verify AC9 by confirming non-transition actions don't set `triggerNewSession`. They should pass immediately since `tests_failed`, `tests_passed`, and `close_issue` handlers don't set this flag.

**Step 3 — Write minimal implementation**

No implementation changes needed — non-transition handlers already return without `triggerNewSession`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/tool-signal.test.ts -t "triggerNewSession — non-transition actions"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
