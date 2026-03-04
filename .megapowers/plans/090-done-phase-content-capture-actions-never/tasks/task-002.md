---
id: 2
title: Fix write-changelog — consume on any non-empty LLM response
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
files_to_create: []
---

## Context

After Task 1, `capture-learnings` is fixed. The remaining failing test is for `write-changelog`: the done.md prompt says "Return only the entry block" but a minimal compliant entry is ~58 chars, below the `text.length > 100` guard. The guard must be lowered to `text.length > 0` so that any non-empty response triggers consumption for `write-changelog`, `generate-docs`, and `generate-bugfix-summary`.

**Failing test already exists** from the reproduce phase: `tests/bug090-doneactions-deadlock.test.ts` test 2 — still RED after Task 1.

## Step 1 — Write the failing test

The test already exists in `tests/bug090-doneactions-deadlock.test.ts`. Verify it is still RED after Task 1:

```typescript
// tests/bug090-doneactions-deadlock.test.ts — test 2 (already present)

const CHANGELOG_ENTRY_SHORT =
`## [Unreleased]
### Fixed
- Fix done-phase deadlock (#090)`;
// ^ 58 chars — under the 100-char guard

it("BUG: write-changelog stays stuck when LLM produces short changelog entry (< 100 chars)", async () => {
  setState(tmp, {
    phase: "done",
    doneActions: ["write-changelog"],
    doneChecklistShown: true,
  });

  const deps = makeDeps(tmp);
  await onAgentEnd(
    makeAgentEndEvent(CHANGELOG_ENTRY_SHORT),
    makeCtx(tmp),
    deps as any,
  );

  const state = readState(tmp);
  expect(state.doneActions).toEqual([]);                                      // FAILS: still ["write-changelog"]
  expect((deps.store as any)._getChangelog()).toContain("Unreleased");         // FAILS: nothing appended
});
```

## Step 2 — Run test, verify it fails

```
bun test tests/bug090-doneactions-deadlock.test.ts
```

Expected: FAIL — specifically test 2:
```
✗ BUG: write-changelog stays stuck when LLM produces short changelog entry (< 100 chars)
  expect(["write-changelog"]).toEqual([])
```

## Step 3 — Write minimal implementation

In `extensions/megapowers/hooks.ts`, change the content-capture block guard from `text.length > 100` to `text.length > 0`, and update the comment:

**Before** (lines 192–207):
```typescript
    // Content-capture actions — need LLM-generated text > 100 chars
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (lastAssistant) {
      const text = getAssistantText(lastAssistant);
      if (text && text.length > 100) {
        if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") {
          store.writeFeatureDoc(state.activeIssue, text);
          if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
        }
        if (doneAction === "write-changelog") {
          store.appendChangelog(text);
          if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
        }
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      }
    }
```

**After**:
```typescript
    // Content-capture actions — consume on any non-empty LLM response
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    if (lastAssistant) {
      const text = getAssistantText(lastAssistant);
      if (text && text.length > 0) {
        if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") {
          store.writeFeatureDoc(state.activeIssue, text);
          if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
        }
        if (doneAction === "write-changelog") {
          store.appendChangelog(text);
          if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
        }
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      }
    }
```

Two changes only:
1. Comment: `"need LLM-generated text > 100 chars"` → `"consume on any non-empty LLM response"`
2. Guard: `text.length > 100` → `text.length > 0`

## Step 4 — Run test, verify it passes

```
bun test tests/bug090-doneactions-deadlock.test.ts
```

Expected: PASS — all 3 tests now pass:
- Test 1: capture-learnings consumed on short response ✅ (fixed in Task 1)
- Test 2: write-changelog consumed on 58-char entry, changelog appended ✅ (fixed here)
- Test 3: end-to-end capture-learnings + close-issue, activeIssue resets to null ✅ (fixed in Task 1)

## Step 5 — Verify no regressions

```
bun test
```

Expected: all passing. Regression coverage:
- `hooks.test.ts:88` ("removes generate-docs from doneActions after agent produces long text") — still passes, `150 > 0` is true ✅
- `hooks.test.ts:73` ("removes capture-learnings from doneActions after agent produces long text") — still passes, unconditional handler fires ✅
- `hooks.test.ts:521` (end-to-end headless default actions) — still passes, all content-capture turns use 150-char text ✅
