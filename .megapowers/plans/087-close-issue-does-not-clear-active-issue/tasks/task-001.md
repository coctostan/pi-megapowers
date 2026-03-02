---
id: 1
title: Fix onAgentEnd to clear state on close-issue and always consume
  non-content-capture done actions
status: needs_revision
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
files_to_create: []
---

### Task 1: Fix `onAgentEnd` to clear state on `close-issue` and always consume non-content-capture done actions

**Covers Fixed-When criteria 1–7.**

The failing test file `tests/hooks-close-issue.test.ts` already exists and captures both bugs. This task adopts it, then fixes both bugs in `extensions/megapowers/hooks.ts`.
**Why one task (not two):** Bug 2 (non-content-capture actions not consumed) is a prerequisite for Bug 1 to be reachable. When `capture-learnings` precedes `close-issue` in the queue, Bug 2 leaves `capture-learnings` stuck so `close-issue` is never processed — making Bug 1 unreachable in that scenario. Both bugs live in the same ~20-line block of `onAgentEnd`; fixing them together is a single coherent change, and the test file already captures both in one `describe`. Splitting would add a spurious inter-task dependency with no benefit.

---

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-close-issue.test.ts`

---

#### Step 1 — The failing test (full contents)

`tests/hooks-close-issue.test.ts` — 6 tests, all currently fail. **No changes needed to this file.**

```typescript
/**
 * Failing tests for issue 087: close-issue done action doesn't clear activeIssue/phase
 *
 * These tests FAIL now and should PASS when the bug is fixed.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { onAgentEnd } from "../extensions/megapowers/hooks.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function makeStore(overrides?: { getSourceIssues?: (slug: string) => any[] }) {
  return {
    writeFeatureDoc: (_slug: string, _text: string) => {},
    appendChangelog: (_text: string) => {},
    getSourceIssues: (_slug: string): any[] => [],
    updateIssueStatus: (_slug: string, _status: string) => {},
    ...overrides,
  };
}

function makeCtx(cwd: string, hasUI = false) {
  return {
    hasUI,
    cwd,
    ui: { notify: () => {} },
  };
}

function makeDeps(cwd: string, storeOverrides?: { getSourceIssues?: (slug: string) => any[] }) {
  return {
    store: makeStore(storeOverrides),
    ui: { renderDashboard: () => {} },
    jj: null,
  };
}

function makeAgentEndEvent(text: string = "") {
  return {
    messages: text
      ? [{ role: "assistant", content: [{ type: "text", text }] }]
      : [],
  };
}

function setState(cwd: string, overrides: any) {
  writeState(cwd, {
    ...createInitialState(),
    activeIssue: "001-test-issue",
    workflow: "feature",
    phase: "done",
    ...overrides,
  });
}

describe("onAgentEnd — close-issue clears activeIssue and phase (issue 087)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-close-issue-test-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("clears activeIssue to null after close-issue fires", async () => {
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });
    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);
    const state = readState(tmp);
    expect(state.activeIssue).toBeNull();
  });

  it("clears phase to null after close-issue fires", async () => {
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });
    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);
    const state = readState(tmp);
    expect(state.phase).toBeNull();
  });

  it("removes close-issue from doneActions after it fires", async () => {
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });
    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);
    const state = readState(tmp);
    expect(state.doneActions).toEqual([]);
  });

  it("calls updateIssueStatus to mark issue done", async () => {
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });
    let updatedSlug: string | null = null;
    let updatedStatus: string | null = null;
    const deps = {
      store: makeStore({ getSourceIssues: () => [] }),
      ui: { renderDashboard: () => {} },
      jj: null,
    };
    (deps.store as any).updateIssueStatus = (slug: string, status: string) => {
      updatedSlug = slug;
      updatedStatus = status;
    };
    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), deps as any);
    expect(updatedSlug).toBe("001-test-issue");
    expect(updatedStatus).toBe("done");
  });

  it("new session after close-issue shows no active issue", async () => {
    setState(tmp, { phase: "done", doneActions: ["close-issue"] });
    await onAgentEnd(makeAgentEndEvent(), makeCtx(tmp), makeDeps(tmp) as any);
    const stateOnNextSession = readState(tmp);
    expect(stateOnNextSession.activeIssue).toBeNull();
    expect(stateOnNextSession.phase).toBeNull();
    expect(stateOnNextSession.doneActions).toEqual([]);
  });

  it("secondary bug: unrecognized done actions (e.g. capture-learnings) are consumed even with short LLM text", async () => {
    setState(tmp, { phase: "done", doneActions: ["capture-learnings", "close-issue"] });
    // Short response (< 100 chars) — capture-learnings should STILL be consumed
    await onAgentEnd(makeAgentEndEvent("short"), makeCtx(tmp), makeDeps(tmp) as any);
    const state = readState(tmp);
    expect(state.doneActions).not.toContain("capture-learnings");
  });
});
```

#### Step 2 — Run test, verify it fails

```
bun test tests/hooks-close-issue.test.ts
```

Expected: **0 pass, 6 fail**.

**Tests 1–5 fail due to Bug 1** (`close-issue` does not write initial state):

```
✗ clears activeIssue to null after close-issue fires
  expect(received).toBeNull()
  Received: "001-test-issue"

✗ clears phase to null after close-issue fires
  expect(received).toBeNull()
  Received: "done"

✗ removes close-issue from doneActions after it fires
  expect(received).toEqual([])
  Received: ["close-issue"]

✗ calls updateIssueStatus to mark issue done
  expect(received).toBe("001-test-issue")
  Received: null

✗ new session after close-issue shows no active issue
  expect(received).toBeNull()   ← activeIssue
  Received: "001-test-issue"
```

**Test 6 fails due to Bug 2** (non-content-capture actions not consumed with short LLM text):

```
✗ secondary bug: unrecognized done actions (e.g. capture-learnings) are consumed even with short LLM text
  expect(received).not.toContain("capture-learnings")
  Received: ["capture-learnings", "close-issue"]
```

#### Step 3 — Write minimal implementation

**Two changes to `extensions/megapowers/hooks.ts`:**

**Change A** — add `createInitialState` to the import from `./state/state-machine.js`:

```typescript
// Before (line 2):
import { readState, writeState } from "./state/state-io.js";

// After:
import { readState, writeState } from "./state/state-io.js";
import { createInitialState } from "./state/state-machine.js";
```

**Change B** — replace the entire done-phase block in `onAgentEnd` (lines 125–143 in current file):

```typescript
  // Done-phase artifact capture / close-issue handler
  if (phase === "done" && state.doneActions.length > 0) {
    const doneAction = state.doneActions[0];

    // Handle close-issue immediately — no LLM text needed
    if (doneAction === "close-issue") {
      store.updateIssueStatus(state.activeIssue!, "done");
      writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });
      // Return early: state is fully reset to idle; no dashboard re-render needed.
      // renderDashboard would receive the stale pre-reset snapshot captured in this
      // closure — the next session start reads the fresh idle state from disk.
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

**Why this works:**

- **Bug 1**: The `close-issue` branch calls `writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled })`. `createInitialState()` returns `activeIssue: null`, `phase: null`, `workflow: null`, `jjChangeId: null`, `doneActions: []`, etc. The only field carried over is `megaEnabled` (user preference). The early `return` is intentional: `renderDashboard` would receive the stale pre-reset state snapshot captured in the `onAgentEnd` closure — returning instead lets the next session start pick up the fresh idle state from disk, showing a clean dashboard.

- **Bug 2**: Non-content-capture actions (those not in `contentCaptureActions`) now hit the `else` branch and are always consumed via `writeState(...filter...)`, regardless of LLM text length. This unblocks the queue so `close-issue` is reachable in subsequent iterations.

#### Step 4 — Run test, verify it passes

```
bun test tests/hooks-close-issue.test.ts
```

Expected: **6 pass, 0 fail**

#### Step 5 — Verify no regressions

```
bun test
```

Expected: all tests passing (48+ test files, 0 failures)
