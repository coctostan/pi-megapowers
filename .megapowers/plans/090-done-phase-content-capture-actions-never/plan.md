# Plan

### Task 1: Fix capture-learnings — add unconditional handler before text-scraping block

## Context

`onAgentEnd` processes `doneActions[0]` each turn. `capture-learnings` falls through to a shared content-capture block guarded by `if (text && text.length > 100)`. The `done.md` prompt for `capture-learnings` tells the LLM to call `write()` directly, producing a short acknowledgment response (~39 chars). The guard fails → action never consumed → deadlock. Additionally, `tests/hooks.test.ts` line 120 asserts this buggy behavior as correct.

**Failing tests already exist** from the reproduce phase: `tests/bug090-doneactions-deadlock.test.ts` (tests 1 and 3 — see below). They are RED right now.

## Step 1 — Write the failing test

Two things to do:

**1a. Verify the reproduce-phase tests are RED** (no code changes needed — they already exist in `tests/bug090-doneactions-deadlock.test.ts`):

```typescript
// tests/bug090-doneactions-deadlock.test.ts — tests 1 and 3 (already present, already failing)

it("BUG: capture-learnings stays stuck forever when LLM writes file directly and produces short response", async () => {
  setState(tmp, {
    phase: "done",
    doneActions: ["capture-learnings"],
    doneChecklistShown: true,
  });

  await onAgentEnd(
    makeAgentEndEvent("I've written the learnings to the file."),
    makeCtx(tmp),
    makeDeps(tmp) as any,
  );

  const state = readState(tmp);
  expect(state.doneActions).toEqual([]); // currently FAILS
});

it("BUG: end-to-end — capture-learnings blocks close-issue permanently in real scenario", async () => {
  setState(tmp, {
    phase: "done",
    doneActions: ["capture-learnings", "close-issue"],
    doneChecklistShown: true,
  });

  const statusUpdates: { slug: string; status: string }[] = [];
  const deps = {
    store: {
      ...makeStore(),
      getSourceIssues: () => [],
      updateIssueStatus: (slug: string, status: string) =>
        statusUpdates.push({ slug, status }),
    },
    ui: { renderDashboard: () => {} },
  };

  for (let i = 0; i < 5; i++) {
    await onAgentEnd(
      makeAgentEndEvent("I've written the learnings to the file."),
      makeCtx(tmp),
      deps as any,
    );
  }

  const state = readState(tmp);
  expect(state.activeIssue).toBeNull(); // currently FAILS
  expect(statusUpdates.some(u => u.status === "done")).toBe(true); // currently FAILS
});
```

**1b. Update `tests/hooks.test.ts` line 120** — change the test that asserts buggy behavior to assert correct behavior (this makes it RED):

Find the test currently reading:
```typescript
it("does nothing when text is shorter than 100 chars", async () => {
  setState(tmp, { phase: "done", doneActions: ["capture-learnings"] });

  await onAgentEnd(makeAgentEndEvent("short response"), makeCtx(tmp), makeDeps(tmp) as any);

  // Short text means the capture block is not entered — list unchanged
  expect(readState(tmp).doneActions).toEqual(["capture-learnings"]);
});
```

Replace it with:
```typescript
it("consumes capture-learnings unconditionally regardless of response length", async () => {
  setState(tmp, { phase: "done", doneActions: ["capture-learnings"] });

  await onAgentEnd(makeAgentEndEvent("short response"), makeCtx(tmp), makeDeps(tmp) as any);

  // capture-learnings is consumed unconditionally: LLM already wrote the file via write()
  // The response length is irrelevant — no text scraping occurs for this action.
  expect(readState(tmp).doneActions).toEqual([]);
});
```

## Step 2 — Run test, verify it fails

```
bun test tests/bug090-doneactions-deadlock.test.ts tests/hooks.test.ts
```

Expected: FAIL — at minimum:
```
✗ BUG: capture-learnings stays stuck forever when LLM writes file directly and produces short response
  expect(["capture-learnings"]).toEqual([])

✗ BUG: end-to-end — capture-learnings blocks close-issue permanently in real scenario
  expect("090-done-phase-bug").toBeNull()

✗ consumes capture-learnings unconditionally regardless of response length
  expect(["capture-learnings"]).toEqual([])
```

## Step 3 — Write minimal implementation

In `extensions/megapowers/hooks.ts`, insert an explicit unconditional handler for `capture-learnings` after the `push-and-pr` block (after line 190, before the `// Content-capture actions` comment at line 192).

The new block goes between the closing `}` of push-and-pr and the `// Content-capture actions` comment:

```typescript
    // capture-learnings: LLM writes file directly via write() — no text scraping, consume unconditionally
    if (doneAction === "capture-learnings") {
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      return;
    }

    // Content-capture actions — need LLM-generated text > 100 chars
    const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
    // ... rest of the content-capture block unchanged ...
```

The full modified `onAgentEnd` done-phase block (after push-and-pr handler at line 190):

```typescript
    // capture-learnings: LLM writes file directly via write() — no text scraping, consume unconditionally
    if (doneAction === "capture-learnings") {
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      return;
    }

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
  }
```

## Step 4 — Run test, verify it passes

```
bun test tests/bug090-doneactions-deadlock.test.ts tests/hooks.test.ts
```

Expected: PASS — tests 1 and 3 in bug090 file now pass; updated hooks.test.ts test passes. Test 2 in bug090 (write-changelog) still fails — that's addressed in Task 2.

## Step 5 — Verify no regressions

```
bun test
```

Expected: all passing (note: `tests/bug090-doneactions-deadlock.test.ts` test 2 still fails — it's fixed in Task 2).

### Task 2: Fix write-changelog — consume on any non-empty LLM response [depends: 1]

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
