---
id: 4
title: Defer showDoneChecklist to onAgentEnd in hooks.ts
status: approved
depends_on:
  - 1
  - 2
  - 3
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
files_to_create: []
---

### Task 4: Defer showDoneChecklist to onAgentEnd in hooks.ts [depends: 1, 2, 3]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks.test.ts`

This completes the #083 fix — `onAgentEnd` now checks for `phase === "done" && doneActions.length === 0 && activeIssue` and calls `showDoneChecklist` there. The `doneChecklistShown` flag prevents re-invocation.

**Step 1 — Write the failing test**
**First, update the existing conflicting test in `tests/hooks.test.ts`.**

In the `"onAgentEnd — done-phase doneActions cleanup"` describe block (around line 103), the test `"does nothing when doneActions is empty"` asserts that doneActions stays empty — but after this implementation, an empty `doneActions` in done phase will *trigger* the checklist, populating them. Replace the existing test with:

```typescript
it("populates doneActions (and sets doneChecklistShown) when in done phase with empty doneActions", async () => {
  setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

  await onAgentEnd(makeAgentEndEvent("done"), makeCtx(tmp, /* hasUI */ false), makeDeps(tmp) as any);

  const state = readState(tmp);
  expect(state.doneActions.length).toBeGreaterThan(0);
  expect(state.doneChecklistShown).toBe(true);
});
```

(To keep a "does nothing" variant: set `doneChecklistShown: true` in setup — the guard prevents re-invocation.)

**Then, add a new describe block at the end of `tests/hooks.test.ts`:**

```typescript
describe("onAgentEnd — deferred done checklist (#083)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-done-checklist-"));
    mkdirSync(join(tmp, ".megapowers"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("calls showDoneChecklist when phase=done, doneActions=[], hasUI=true, doneChecklistShown=false", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    let checklistCalled = false;
    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        notify: () => {},
        custom: async (_fn: any) => {
          checklistCalled = true;
          return ["generate-docs", "close-issue"];
        },
      },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("review complete"), ctx as any, deps as any);

    expect(checklistCalled).toBe(true);
    const state = readState(tmp);
    expect(state.doneChecklistShown).toBe(true);
    // doneActions should be set from the checklist
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneActions).toContain("close-issue");
  });

  it("does NOT call showDoneChecklist when doneChecklistShown=true", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: true });

    let checklistCalled = false;
    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        notify: () => {},
        custom: async (_fn: any) => {
          checklistCalled = true;
          return ["close-issue"];
        },
      },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

    expect(checklistCalled).toBe(false);
  });

  it("auto-populates defaults in headless mode (hasUI=false) via showDoneChecklist", async () => {
    setState(tmp, { phase: "done", doneActions: [], doneChecklistShown: false });

    const ctx = {
      hasUI: false,
      cwd: tmp,
      ui: { notify: () => {} },
    };

    const deps = {
      store: {
        ...makeStore(tmp),
        updateIssueStatus: () => {},
        getSourceIssues: () => [],
      },
      ui: { renderDashboard: () => {} },
    };

    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);

    const state = readState(tmp);
    // Headless: showDoneChecklist auto-selects defaults
    expect(state.doneActions).toContain("close-issue");
    expect(state.doneActions).toContain("generate-docs");
    expect(state.doneChecklistShown).toBe(true);
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/hooks.test.ts -t "deferred done checklist"`

Expected: FAIL — `expect(received).toBe(expected) // Expected: true, Received: false` — because `onAgentEnd` does not currently call `showDoneChecklist` or set `doneChecklistShown`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/hooks.ts`:

1. Add import for `showDoneChecklist` at the top (after the existing imports):

```typescript
import { showDoneChecklist } from "./ui.js";
```

2. In the `onAgentEnd` function, insert a new branch BEFORE the existing done-action processing block (before line 102 `if (phase === "done" && state.doneActions.length > 0)`):

```typescript
  // Deferred done checklist — fires after agent turn completes (#083 fix)
  if (phase === "done" && state.doneActions.length === 0 && state.activeIssue && !state.doneChecklistShown) {
    await showDoneChecklist(ctx, ctx.cwd);
    writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });
    return; // Don't process actions yet — next turn will execute them
  }
```

The full `onAgentEnd` function after this change:

```typescript
export async function onAgentEnd(event: any, ctx: any, deps: Deps): Promise<void> {
  const { store, ui } = deps;

  const state = readState(ctx.cwd);
  if (!state.activeIssue || !state.phase) return;

  const phase = state.phase;

  // Deferred done checklist — fires after agent turn completes (#083 fix)
  if (phase === "done" && state.doneActions.length === 0 && state.activeIssue && !state.doneChecklistShown) {
    await showDoneChecklist(ctx, ctx.cwd);
    writeState(ctx.cwd, { ...readState(ctx.cwd), doneChecklistShown: true });
    return;
  }

  // Done-phase action processing
  if (phase === "done" && state.doneActions.length > 0) {
    // ... existing code unchanged ...
  }

  // Refresh dashboard after agent turn (AC9, AC10 — no blocking popup)
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
}
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/hooks.test.ts -t "deferred done checklist"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
