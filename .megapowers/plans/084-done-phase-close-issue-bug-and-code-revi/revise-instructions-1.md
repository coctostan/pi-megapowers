# Revision instructions (iteration 1)

These revisions are required so the plan matches the real code behavior and the repo’s existing test suite.

## Task 4: Defer showDoneChecklist to onAgentEnd in hooks.ts

### Fix existing failing test in `tests/hooks.test.ts`
After you add the new onAgentEnd branch (`phase === "done" && doneActions.length === 0 && !doneChecklistShown`), the existing test in `tests/hooks.test.ts`:

- `it("does nothing when doneActions is empty", ...)`

will no longer be true. With the new behavior, **empty `doneActions` in done phase should trigger checklist/default population**.

Update that test to match the new behavior (or delete it and rely on the new tests you add). Minimal replacement that matches the intended semantics:

```ts
it("populates doneActions (and sets doneChecklistShown) when in done phase with empty doneActions", async () => {
  setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

  await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, /* hasUI */ false), makeDeps(tmp) as any);

  const state = readState(tmp);
  expect(state.doneActions.length).toBeGreaterThan(0);
  expect(state.doneChecklistShown).toBe(true);
});
```

(If you *really* want a “does nothing” test, set `doneChecklistShown: true` in the setup to exercise the guard.)

## Task 5: End-to-end headless onAgentEnd processes close-issue and resets state

### The current test logic is incorrect (doneActions are processed one-at-a-time)
In `extensions/megapowers/hooks.ts`, `onAgentEnd` processes **only the first** action in `state.doneActions` per call:

```ts
const doneAction = state.doneActions[0];
```

And the default headless auto-selection (from `getDoneChecklistItems`) is ordered as:

1. `generate-docs` (or `generate-bugfix-summary`)
2. `write-changelog`
3. `capture-learnings`
4. `push-and-pr`
5. `close-issue`

So **`close-issue` will not execute on the 2nd `onAgentEnd` call** unless you either:
- reorder defaults (not recommended; close-issue should stay last), or
- simulate consuming the earlier actions across multiple turns.

### Update the regression test to simulate the real sequence
Instead of “2 calls → close-issue executed”, make it:

- 1st call: deferred checklist runs (headless) → populates `doneActions` and sets `doneChecklistShown`
- Next calls: repeatedly call `onAgentEnd` to consume the earlier actions until `close-issue` is first
- Final call: `close-issue` executes → `updateIssueStatus` called → state reset

Concrete test skeleton you can drop in (note the long text to satisfy the `> 100 chars` gating for content-capture actions):

```ts
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

  // 1) Populate defaults (deferred checklist)
  await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

  // 2-4) Consume content-capture actions (requires >100 chars)
  const longText = "A".repeat(150);
  await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // generate-docs
  await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // write-changelog
  await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // capture-learnings

  // 5) Consume push-and-pr (immediate; with no execGit/branch it will be skipped+consumed)
  await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);

  // 6) Now close-issue should be first and execute
  await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);

  expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
  const finalState = readState(tmp);
  expect(finalState.activeIssue).toBeNull();
  expect(finalState.phase).toBeNull();
});
```

This matches the actual production semantics and is stable even if more content actions are added (as long as they’re default-checked and precede close-issue).

## Task 6: Update reproduction tests to assert fixed behavior

### Remove duplication with Task 3
Task 3 already updates the `#083` reproduction assertion about `register-tools.ts` not containing `showDoneChecklist`. Don’t repeat that change again in Task 6.

### Fix the TDD step ordering / expected outputs
As written, Task 6’s Step 2 (“expected FAIL…”) is ambiguous because the task *depends on* Tasks 2–4 (meaning the fix is already in place).

Make Task 6 explicitly a **test-maintenance** task:

- Either mark it `[no-test]` with justification: “updates reproduction tests that were asserting buggy behavior; production behavior already validated by Tasks 2–5”, and include verification commands.

OR

- Keep TDD steps, but make Step 2 reflect the real state of the repo at that point:
  - Before editing, `bun test tests/reproduce-084-batch.test.ts` should FAIL because the old `BUG:` assertions are now wrong.
  - After editing, it should PASS.

Also: your list says “update three tests” but actually lists **four** replacements — tighten that up.
