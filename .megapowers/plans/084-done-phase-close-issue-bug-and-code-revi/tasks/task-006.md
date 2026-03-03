---
id: 6
title: Update reproduction tests to assert fixed behavior
status: approved
depends_on:
  - 2
  - 3
  - 4
no_test: true
files_to_modify:
  - tests/reproduce-084-batch.test.ts
files_to_create: []
---

### Task 6: Update reproduction tests to assert fixed behavior [depends: 2, 3, 4]
- Modify: `tests/reproduce-084-batch.test.ts`
**[no-test]** Justification: updates reproduction tests that were asserting buggy behavior; production behavior already validated by Tasks 2–5.
The existing `BUG:` tests in `tests/reproduce-084-batch.test.ts` were written to document the bugs — after Tasks 2–4 land, they will assert the *wrong* thing (e.g., `doneActions` will now be populated, not empty). This task replaces them with `FIX:` versions that assert the correct behavior.

**Note:** The `"UX-ISSUE: showDoneChecklist fires synchronously inside tool execute"` test in the `#083` describe block is already updated by Task 3 — do **not** repeat that change here.

**Changes to make in `tests/reproduce-084-batch.test.ts`**

**Replacement 1.** Replace `"BUG: showDoneChecklist is a no-op when ctx.hasUI is false, leaving doneActions empty"` with:

```typescript
  it("FIX: showDoneChecklist auto-populates defaults when ctx.hasUI is false (#081)", async () => {
    setState(tmp, { phase: "done", doneActions: [] });
    const ctx = makeCtx(tmp, /* hasUI */ false);
    await showDoneChecklist(ctx, tmp);
    const state = readState(tmp);
    // After fix: doneActions should contain all default-checked items
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneActions).toContain("write-changelog");
    expect(state.doneActions).toContain("capture-learnings");
    expect(state.doneActions).toContain("push-and-pr");
    expect(state.doneActions).toContain("close-issue");
  });
```

**Replacement 2.** Replace `"BUG: onAgentEnd skips close-issue when doneActions is empty (the consequence)"` with:

```typescript
  it("FIX: onAgentEnd invokes showDoneChecklist and populates doneActions when empty (#081)", async () => {
    setupIssue(tmp);
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });
    const statusUpdates: { slug: string; status: string }[] = [];
    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: (slug: string, status: string) => {
          statusUpdates.push({ slug, status });
        },
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };
    // First call: deferred checklist populates doneActions (headless auto-defaults)
    await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, false), deps as any);
    const state = readState(tmp);
    // doneActions should now be populated via auto-defaults
    expect(state.doneActions.length).toBeGreaterThan(0);
    expect(state.doneChecklistShown).toBe(true);
  });
```

**Replacement 3.** Replace `"BUG: buildInjectedPrompt returns NO done template when doneActions is empty"` with:

```typescript
  it("FIX: buildInjectedPrompt injects done template when doneActions is populated after headless auto-fill (#081)", () => {
    // After the headless fix, doneActions will be populated, so done.md template IS injected
    setState(tmp, {
      phase: "done",
      doneActions: ["generate-docs", "write-changelog", "capture-learnings", "push-and-pr", "close-issue"],
      megaEnabled: true,
    });
    const prompt = buildInjectedPrompt(tmp);
    expect(prompt).toContain("wrap-up actions");
    expect(prompt).toContain("close-issue");
  });
```

**Verification**

Before editing (with Tasks 2–4 implemented but before this task), run:

```sh
bun test tests/reproduce-084-batch.test.ts
```

Expected: FAIL — the old `BUG:` tests now assert the wrong behavior (e.g., `expect(doneActions).toEqual([])` will fail because `doneActions` is now populated):

```
expect(received).toEqual(expected)
Expected: []
Received: ["generate-docs", "write-changelog", "capture-learnings", "push-and-pr", "close-issue"]
```

After editing (replacing `BUG:` tests with `FIX:` tests), run:

```sh
bun test tests/reproduce-084-batch.test.ts
```

Expected: PASS

Full suite:

```sh
bun test
```
Expected: all passing
