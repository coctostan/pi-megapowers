---
id: 2
title: showDoneChecklist auto-populates defaults in headless mode
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create: []
---

### Task 2: showDoneChecklist auto-populates defaults in headless mode [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

This fixes bug #081 — when `ctx.hasUI` is `false`, `showDoneChecklist` now auto-selects all default-checked items instead of returning early with no action.

**Step 1 — Write the failing test**

In `tests/ui.test.ts`, find the `describe("showDoneChecklist (AC11, AC13, AC14)")` block and add:

```typescript
  it("auto-populates doneActions with defaults when ctx.hasUI is false (headless fix #081)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = { hasUI: false, cwd: tmp2 };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);

    // All default-checked items should be auto-selected
    expect(updated.doneActions).toContain("generate-docs");
    expect(updated.doneActions).toContain("write-changelog");
    expect(updated.doneActions).toContain("capture-learnings");
    expect(updated.doneActions).toContain("push-and-pr");
    expect(updated.doneActions).toContain("close-issue");
    expect(updated.doneActions.length).toBe(5);
  });

  it("auto-populates bugfix defaults when ctx.hasUI is false (headless fix #081 bugfix variant)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = { hasUI: false, cwd: tmp2 };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);

    // Bugfix uses generate-bugfix-summary instead of generate-docs
    expect(updated.doneActions).toContain("generate-bugfix-summary");
    expect(updated.doneActions).not.toContain("generate-docs");
    expect(updated.doneActions).toContain("close-issue");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/ui.test.ts -t "auto-populates doneActions with defaults when ctx.hasUI is false"`

Expected: FAIL — `expect(received).toContain(expected) // Expected: "generate-docs"` — because the current code early-returns on `!ctx.hasUI` and doneActions remains `[]`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, replace the `showDoneChecklist` function (lines 78-93):

```typescript
export async function showDoneChecklist(ctx: any, cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state.activeIssue || state.phase !== "done") return;

  if (!ctx.hasUI) {
    // Headless: auto-select all default-checked items (#081 fix)
    const doneActions = getDoneChecklistItems(state)
      .filter(i => i.defaultChecked)
      .map(i => i.key);
    writeState(cwd, { ...readState(cwd), doneActions });
    return;
  }

  const checklistItems = getDoneChecklistItems(state);
  const selectedKeys = await showChecklistUI(
    ctx,
    checklistItems.map((i) => ({ key: i.key, label: i.label, checked: i.defaultChecked })),
    "Done — select wrap-up actions to perform:",
  );

  // null = dismissed (Escape) → store empty array
  const doneActions = selectedKeys ?? [];
  writeState(cwd, { ...readState(cwd), doneActions });
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/ui.test.ts -t "auto-populates doneActions with defaults when ctx.hasUI is false"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing (the existing "BUG" reproduction test in `tests/reproduce-084-batch.test.ts` will now fail since the behavior is fixed — update that test to assert the fixed behavior)
