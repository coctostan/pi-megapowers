---
id: 11
title: Done checklist push-and-pr item
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
  - tests/ui.test.ts
files_to_create: []
---

### Task 11: Done checklist push-and-pr item

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to `tests/ui.test.ts` inside the existing `describe("getDoneChecklistItems (AC12)")` block:

```typescript
it("includes push-and-pr item checked by default (AC17)", () => {
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    phase: "done",
  };
  const items = getDoneChecklistItems(state);
  const pushItem = items.find(i => i.key === "push-and-pr");
  expect(pushItem).toBeDefined();
  expect(pushItem!.label).toBe("Push & create PR");
  expect(pushItem!.defaultChecked).toBe(true);
});

it("includes push-and-pr in bugfix workflow too (AC17)", () => {
  const state: MegapowersState = {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "bugfix",
    phase: "done",
  };
  const items = getDoneChecklistItems(state);
  const keys = items.map(i => i.key);
  expect(keys).toContain("push-and-pr");
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts`
Expected: FAIL — expect(received).toBeDefined() — pushItem is undefined because "push-and-pr" is not in the checklist

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, in `getDoneChecklistItems`, add the push-and-pr item before the close-issue item. The function currently ends with:

```typescript
  items.push({ key: "close-issue", label: "Close issue", defaultChecked: true });
  return items;
```

Insert before that line:

```typescript
  items.push({ key: "push-and-pr", label: "Push & create PR", defaultChecked: true });
```

So the final ordering is: generate-docs/generate-bugfix-summary → write-changelog → capture-learnings → push-and-pr → close-issue.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing

**Note:** The existing test "feature workflow: returns generate-docs, write-changelog, capture-learnings, close-issue all defaultChecked" checks `items.length >= 4`. With push-and-pr added, it becomes 5 items. The `>= 4` assertion still passes. The existing `every(defaultChecked === true)` assertion also passes since push-and-pr is defaultChecked.
