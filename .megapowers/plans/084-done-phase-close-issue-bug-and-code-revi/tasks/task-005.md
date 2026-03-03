---
id: 5
title: "End-to-end: headless onAgentEnd processes close-issue and resets state"
status: approved
depends_on:
  - 2
  - 4
no_test: true
files_to_modify:
  - tests/hooks.test.ts
files_to_create: []
---

### Task 5: End-to-end: headless onAgentEnd processes close-issue and resets state [depends: 2, 4]
- Modify: `tests/hooks.test.ts`

**[no-test]** Justification: Integration/regression test that validates the combined behavior of Tasks 2 and 4. No new production code — test passes on write since dependencies are already implemented.

This is the regression test for #081 — verifying the complete headless path end-to-end. Because `onAgentEnd` processes **only the first** action in `state.doneActions` per call, and the default headless action list is ordered `generate-docs → write-changelog → capture-learnings → push-and-pr → close-issue`, the test must simulate **6 calls total**: 1 to populate defaults (deferred checklist) + 3 to consume content-capture actions + 1 to consume push-and-pr + 1 to finally execute close-issue.

**Changes to `tests/hooks.test.ts`:**

1. Add `writeFileSync` to the existing `node:fs` import at the top of the file:

```typescript
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
```

2. Add a local `setupIssue` helper inside the `"onAgentEnd — deferred done checklist (#083)"` describe block:

```typescript
  function setupIssue(cwd: string) {
    const issuesDir = join(cwd, ".megapowers", "issues");
    mkdirSync(issuesDir, { recursive: true });
    writeFileSync(
      join(issuesDir, "001-test.md"),
      "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2025-01-01T00:00:00Z\n---\n# Test Issue\nDescription",
    );
  }
```

3. Add the end-to-end regression test in the same describe block:

```typescript
  it("end-to-end headless: deferred defaults eventually reach close-issue and reset state (#081 regression)", async () => {
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });
    const statusUpdates: { slug: string; status: string }[] = [];
    const ctx = makeCtx(tmp, /* hasUI */ false);
    const deps = {
      store: {
        ...makeStore(tmp),
        getSourceIssues: () => [],
        updateIssueStatus: (slug: string, status: string) => statusUpdates.push({ slug, status }),
      },
      ui: { renderDashboard: () => {} },
    };
    // 1) Populate defaults (deferred checklist fires, doneActions filled, doneChecklistShown = true)
    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);
    // 2-4) Consume content-capture actions (generate-docs, write-changelog, capture-learnings)
    //      Each requires >100 chars of assistant text to be consumed
    const longText = "A".repeat(150);
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // generate-docs
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // write-changelog
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // capture-learnings
    // 5) Consume push-and-pr (immediate; no execGit/branch → skipped+consumed)
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);
    // 6) Now close-issue is first → executes → updateIssueStatus called → state reset
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);
    expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
    const finalState = readState(tmp);
    expect(finalState.activeIssue).toBeNull();
    expect(finalState.phase).toBeNull();
  });
```

**Verification**

Run: `bun test tests/hooks.test.ts -t "end-to-end headless"`

Expected: PASS (Tasks 2 and 4 are already implemented)

Full suite: `bun test`
Expected: all passing
