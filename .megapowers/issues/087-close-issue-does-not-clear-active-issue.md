---
id: 87
type: bugfix
status: open
created: 2026-03-02T00:00:00.000Z
priority: 2
---

# `close-issue` done action doesn't clear `activeIssue` from state

## Problem

When the `close-issue` done action fires in `onAgentEnd`, it removes `close-issue` from `doneActions` but leaves `activeIssue` and `phase` set in `state.json`. This means every new pi session after a completed issue continues to load the done-phase context for that issue indefinitely — the user is stuck until they manually edit `state.json`.

**Observed:** After completing issue 086, every new session re-entered the `done` phase for `086-core-runtime-bugs-issue-close-subagent-w` because `activeIssue` was never cleared.

## Root Cause

`extensions/megapowers/hooks.ts` — the `close-issue` handler (added in issue 086):

```typescript
if (doneAction === "close-issue") {
  const sources = store.getSourceIssues(state.activeIssue);
  for (const source of sources) {
    store.updateIssueStatus(source.slug, "done");
  }
  store.updateIssueStatus(state.activeIssue, "done");
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
  //                    ^^^^^^^^ spreads activeIssue and phase — never cleared!
  ...
  return;
}
```

The `writeState` call spreads `...state`, which preserves `activeIssue` and `phase`. After the handler runs, `state.json` has:
- `doneActions: []` ✅
- `activeIssue: "086-..."` ❌ (should be null)
- `phase: "done"` ❌ (should be null or reset)

## Secondary Issue: Manual done actions block `close-issue` in the queue

`doneActions` is processed as a queue — `onAgentEnd` always handles `doneActions[0]`. Manual actions like `capture-learnings` and `squash-task-changes` have no hook handler, so they only get consumed from the queue when the LLM's session response is > 100 chars (falling through to the content-capture block's unconditional `writeState`). If responses are short, they're never consumed, and `close-issue` is never reached.

**Fix:** Add a fallback removal for unrecognized done actions — regardless of text length:

```typescript
// After the content-capture block, add:
// Fallback: consume unrecognized (manual) done actions so they don't block the queue
writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
```

## Acceptance Criteria

1. After `close-issue` fires in `onAgentEnd`, `activeIssue` is `null` in `state.json`
2. After `close-issue` fires, `phase` is `null` (or equivalent "no active issue" value) in `state.json`
3. A new pi session after issue completion shows no active issue — user is presented with the issue picker or idle state
4. Unrecognized done actions (e.g., `capture-learnings`, `squash-task-changes`) are always consumed from the queue, regardless of LLM response length
5. Regression tests cover both scenarios
