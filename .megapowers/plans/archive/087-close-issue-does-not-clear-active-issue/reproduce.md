# Reproduction: close-issue done action doesn't clear activeIssue/phase from state.json

## Steps to Reproduce

1. Complete any megapowers issue workflow (reach the `done` phase)
2. The `close-issue` action is added to `doneActions` by the done-phase UI
3. `onAgentEnd` fires at the end of the agent's session turn
4. The `close-issue` handler (or fallback path) is executed
5. On the next session start, `readState()` shows `activeIssue` and `phase` still set

### Minimal code path (current `hooks.ts` — no `close-issue` handler at all):

```typescript
// In onAgentEnd, when doneActions = ["close-issue"]:
// 1. Enters the content-capture block
// 2. If text > 100 chars: calls writeState({ ...state, doneActions: [] })
//    → activeIssue and phase are SPREAD FROM state — never cleared
// 3. If text < 100 chars: close-issue is never removed at all
```

### In issue 086's branch (with `close-issue` handler added):

```typescript
if (doneAction === "close-issue") {
  store.updateIssueStatus(state.activeIssue, "done");
  writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
  //                    ^^^^^^^^^ spreads activeIssue and phase — never cleared!
  return;
}
```

## Expected Behavior

After `close-issue` fires in `onAgentEnd`:
- `state.activeIssue` should be `null`
- `state.phase` should be `null`
- `state.doneActions` should be `[]`
- The next session start shows no active issue — user sees the issue picker or idle state

## Actual Behavior

After `close-issue` fires:
- `state.activeIssue` remains set (e.g. `"086-core-runtime-bugs-issue-close-subagent-w"`)
- `state.phase` remains `"done"`
- `state.doneActions` may or may not be cleared depending on text length

Every new session after completing an issue re-enters the `done` phase for the completed issue indefinitely. The user is stuck until they manually edit `.megapowers/state.json`.

**Observed:** After completing issue 086, every new session re-entered the `done` phase for `086-core-runtime-bugs-issue-close-subagent-w`.

## Evidence

### Bug 1: activeIssue never cleared

From test run of `tests/hooks-close-issue.test.ts`:
```
error: expect(received).toBeNull()
Received: "001-test-issue"
  at hooks-close-issue.test.ts:80 — clears activeIssue to null after close-issue fires
```

### Bug 2: phase never cleared

```
error: expect(received).toBeNull()
Received: "done"
  at hooks-close-issue.test.ts:92 — clears phase to null after close-issue fires
```

### Bug 3: close-issue not even removed from doneActions in current main (no handler):

```
error: expect(received).toEqual([])
Received: ["close-issue"]
  at hooks-close-issue.test.ts:104 — removes close-issue from doneActions after it fires
```

This happens because there is no `close-issue` handler in current `hooks.ts`, and the
content-capture block only fires for text > 100 chars. With an empty event, nothing is removed.

### Bug 4: updateIssueStatus never called (no handler in main):

```
error: expect(received).toBe("001-test-issue")
Received: null
  at hooks-close-issue.test.ts:131 — calls updateIssueStatus to mark issue done
```

### Secondary Bug: blocking done actions never consumed

When `doneActions = ["capture-learnings", "close-issue"]` and LLM produces short text (< 100 chars):
```
error: expect(received).not.toContain("capture-learnings")
Received: ["capture-learnings", "close-issue"]
```
`capture-learnings` is never consumed, so `close-issue` is never reached in the queue.

## Root Cause (in hooks.ts)

**Primary:** The `close-issue` handler (added in 086 branch, missing in current main) uses `writeState({ ...state, doneActions: ... })`. The spread operator preserves `activeIssue` and `phase` from the current state object — they are never set to `null`.

**Fix needed:** Change to `writeState({ ...state, activeIssue: null, phase: null, doneActions: [] })`.

**Secondary:** Unrecognized done actions (e.g. `capture-learnings`, `squash-task-changes`) are only consumed from the queue when `text.length > 100`. If the LLM produces a short response, these actions block indefinitely, preventing `close-issue` from being reached.

**Fix needed:** Add a fallback that always consumes unrecognized done actions regardless of text length.

## Environment

- OS: macOS
- Runtime: Bun 1.3.9
- File: `extensions/megapowers/hooks.ts` (current main — `loomkrvu`)
- Also affects: `vkqkstqo` (086 branch `close-issue` handler)

## Failing Test

**File:** `tests/hooks-close-issue.test.ts`

All 6 tests fail (0 pass):
1. `clears activeIssue to null after close-issue fires`
2. `clears phase to null after close-issue fires`
3. `removes close-issue from doneActions after it fires`
4. `calls updateIssueStatus to mark issue done`
5. `new session after close-issue shows no active issue`
6. `secondary bug: unrecognized done actions consumed even with short LLM text`

```
bun test tests/hooks-close-issue.test.ts
→ 0 pass, 6 fail
```

## Reproducibility

**Always** — deterministic, no timing dependency. Reproducible with the unit test on every run.
