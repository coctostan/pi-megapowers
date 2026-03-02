# Plan: 087-close-issue-does-not-clear-active-issue

## Summary

Single-task fix for two bugs in `onAgentEnd` (`extensions/megapowers/hooks.ts`):

1. **Bug 1 (Primary)** — No `close-issue` handler; the fallback `writeState({ ...state, doneActions: [] })` spreads `activeIssue` and `phase` unchanged. Fix: add an explicit `close-issue` handler that resets state to `createInitialState()` (preserving only `megaEnabled`) and calls `store.updateIssueStatus`.

2. **Bug 2 (Secondary)** — Non-content-capture done actions (e.g. `capture-learnings`, `squash-task-changes`) are only consumed when `text.length > 100`. Short LLM responses leave them stuck, blocking `close-issue` from being reached. Fix: restructure the done-phase block to always consume non-content-capture actions, and only gate on text length for the three content-capture actions (`generate-docs`, `generate-bugfix-summary`, `write-changelog`).

## Fixed-When Coverage

| Criterion | Task |
|-----------|------|
| 1. `state.activeIssue` is null after close-issue | Task 1 |
| 2. `state.phase` is null after close-issue | Task 1 |
| 3. `state.doneActions` is [] after close-issue | Task 1 |
| 4. `updateIssueStatus` called with "done" | Task 1 |
| 5. New session after close-issue shows no active issue | Task 1 |
| 6. Unrecognized done actions always consumed | Task 1 |
| 7. All 6 tests in hooks-close-issue.test.ts pass | Task 1 |

## Tasks

### Task 1: Fix onAgentEnd to clear state on close-issue and always consume non-content-capture done actions

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-close-issue.test.ts` (pre-existing failing test — adopted)

**Step 1 — The failing test (full contents inline)**

See `tests/hooks-close-issue.test.ts` — 6 tests, all currently fail. No changes needed to this file.

**Step 2 — Run test, verify it fails**

```
bun test tests/hooks-close-issue.test.ts
```

Expected: **0 pass, 6 fail**.

Tests 1–5 fail due to Bug 1 (close-issue does not reset to initial state):
- `expect(state.activeIssue).toBeNull()` — Received `"001-test-issue"`
- `expect(state.phase).toBeNull()` — Received `"done"`
- `expect(state.doneActions).toEqual([])` — Received `["close-issue"]`
- `expect(updatedSlug).toBe("001-test-issue")` — Received `null`
- `expect(stateOnNextSession.activeIssue).toBeNull()` — Received `"001-test-issue"`

Test 6 fails due to Bug 2 (non-content-capture actions not consumed with short LLM text):
- `expect(state.doneActions).not.toContain("capture-learnings")` — Received `["capture-learnings", "close-issue"]`

**Step 3 — Write minimal implementation**

Two changes to `extensions/megapowers/hooks.ts`:

**Change A** — add `createInitialState` import (after the existing `readState`/`writeState` import):

```typescript
import { createInitialState } from "./state/state-machine.js";
```

**Change B** — replace the done-phase block in `onAgentEnd` (lines 125–143):

```typescript
  // Done-phase artifact capture / close-issue handler
  if (phase === "done" && state.doneActions.length > 0) {
    const doneAction = state.doneActions[0];

    // Handle close-issue immediately — no LLM text needed
    if (doneAction === "close-issue") {
      store.updateIssueStatus(state.activeIssue!, "done");
      writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
      // Return early: state fully reset to idle. renderDashboard would receive
      // the stale pre-reset snapshot; next session start reads fresh idle state from disk.
      return;
    }

    const contentCaptureActions = ["generate-docs", "generate-bugfix-summary", "write-changelog"];
    const isContentCapture = contentCaptureActions.includes(doneAction);

    if (isContentCapture) {
      // Content-capture actions: only process when LLM produces substantial text
      const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
      if (lastAssistant) {
        const text = getAssistantText(lastAssistant);
        if (text && text.length > 100) {
          if (doneAction === "generate-docs" || doneAction === "generate-bugfix-summary") {
            store.writeFeatureDoc(state.activeIssue!, text);
            if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
          }
          if (doneAction === "write-changelog") {
            store.appendChangelog(text);
            if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
          }
          writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
        }
      }
    } else {
      // Non-content-capture actions (e.g. capture-learnings, squash-task-changes):
      // always consume from the queue regardless of LLM text length
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter((a) => a !== doneAction) });
    }
  }
```

**Step 4 — Run test, verify it passes**

```
bun test tests/hooks-close-issue.test.ts
```

Expected: **6 pass, 0 fail**

**Step 5 — Verify no regressions**

```
bun test
```

Expected: all tests passing (48+ test files, 0 failures)
