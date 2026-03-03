# Plan

### Task 1: Add doneChecklistShown to MegapowersState schema

### Task 1: Add doneChecklistShown to MegapowersState schema

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
- Test: `tests/state-machine.test.ts`

This task adds the `doneChecklistShown` field to `MegapowersState` and wires it into `createInitialState()`, `transition()`, and `KNOWN_KEYS` in `state-io.ts`.

**Step 1 — Write the failing test**

In `tests/state-machine.test.ts`, add a new describe block at the end of the file:

```typescript
describe("doneChecklistShown state field", () => {
  it("createInitialState includes doneChecklistShown: false", () => {
    const state = createInitialState();
    expect(state.doneChecklistShown).toBe(false);
  });

  it("transition resets doneChecklistShown to false on every phase change", () => {
    const base: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneChecklistShown: true,
    };
    const next = transition(base, "done");
    expect(next.doneChecklistShown).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/state-machine.test.ts -t "doneChecklistShown"`

Expected: FAIL — Property 'doneChecklistShown' does not exist on type 'MegapowersState'

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`:

1. Add `doneChecklistShown: boolean;` to the `MegapowersState` interface (after `doneActions: string[];` on line 54):

```typescript
export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  planMode: PlanMode;
  planIteration: number;
  currentTaskIndex: number;
  completedTasks: number[];   // PlanTask.index values (1-based)
  tddTaskState: TddTaskState | null;
  doneActions: string[];
  doneChecklistShown: boolean;
  megaEnabled: boolean;
  branchName: string | null;
  baseBranch: string | null;
}
```

2. Add `doneChecklistShown: false,` to `createInitialState()` (after `doneActions: [],` on line 87):

```typescript
export function createInitialState(): MegapowersState {
  return {
    version: 1,
    activeIssue: null,
    workflow: null,
    phase: null,
    phaseHistory: [],
    reviewApproved: false,
    planMode: null,
    planIteration: 0,
    currentTaskIndex: 0,
    completedTasks: [],
    tddTaskState: null,
    doneActions: [],
    doneChecklistShown: false,
    megaEnabled: true,
    branchName: null,
    baseBranch: null,
  };
}
```

3. Add `next.doneChecklistShown = false;` inside `transition()`, right after `next.doneActions = [];` (line 148):

```typescript
  // Reset doneActions on every phase transition
  next.doneActions = [];
  next.doneChecklistShown = false;
```

In `extensions/megapowers/state/state-io.ts`, add `"doneChecklistShown"` to `KNOWN_KEYS`:

```typescript
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "reviewApproved", "planMode", "planIteration", "currentTaskIndex", "completedTasks",
  "tddTaskState", "doneActions", "doneChecklistShown", "megaEnabled", "branchName", "baseBranch",
]);
```

**Step 4 — Run test, verify it passes**

Run: `bun test tests/state-machine.test.ts -t "doneChecklistShown"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 2: showDoneChecklist auto-populates defaults in headless mode [depends: 1]

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

### Task 3: Remove showDoneChecklist from register-tools.ts execute() [depends: 1]

### Task 3: Remove showDoneChecklist from register-tools.ts execute() [depends: 1]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/reproduce-084-batch.test.ts`

This fixes the #083 timing issue — `showDoneChecklist` is no longer called synchronously inside the `megapowers_signal` tool's `execute()` function. The checklist will be deferred to `onAgentEnd` (Task 4).

**Step 1 — Write the failing test**

In `tests/reproduce-084-batch.test.ts`, update the existing test `"UX-ISSUE: showDoneChecklist fires synchronously inside tool execute (timing concern)"` to assert the fix:

```typescript
  it("FIX: showDoneChecklist is NOT called inside megapowers_signal execute (#083)", () => {
    const source = readFileSync(
      join(process.cwd(), "extensions/megapowers/register-tools.ts"),
      "utf-8",
    );

    // After fix: showDoneChecklist should NOT appear in register-tools.ts at all
    expect(source).not.toContain("showDoneChecklist");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/reproduce-084-batch.test.ts -t "FIX: showDoneChecklist is NOT called inside megapowers_signal execute"`

Expected: FAIL — `expect(received).not.toContain(expected) // Expected not to contain: "showDoneChecklist"` — because `showDoneChecklist` is still imported and called in register-tools.ts.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`:

1. Remove the import of `showDoneChecklist` (line 7):
   ```
   // DELETE: import { showDoneChecklist } from "./ui.js";
   ```

2. Remove lines 47-54 (the `AC11` block inside `execute()`):
   ```
   // DELETE the entire block:
   // // AC11: Show done checklist when phase_next advances to done
   // // Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation
   // if (params.action === "phase_next") {
   //   const currentState = readState(ctx.cwd);
   //   if (currentState.phase === "done") {
   //     await showDoneChecklist(ctx, ctx.cwd);
   //   }
   // }
   ```

The `readState` import on line 6 remains because it's used on line 57 for `ui.renderDashboard`.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/reproduce-084-batch.test.ts -t "FIX: showDoneChecklist is NOT called inside megapowers_signal execute"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing

### Task 4: Defer showDoneChecklist to onAgentEnd in hooks.ts [depends: 1, 2, 3]

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

### Task 5: End-to-end: headless onAgentEnd processes close-issue and resets state [no-test] [depends: 2, 4]

### Task 5: End-to-end: headless onAgentEnd processes close-issue and resets state [depends: 2, 4]
- Modify: `tests/hooks.test.ts`

**[no-test]** Justification: Integration/regression test that validates the combined behavior of Tasks 2 and 4. No new production code — test passes on write since dependencies are already implemented.

This is the regression test for #081 — verifying the complete headless path end-to-end. Because `onAgentEnd` processes **only the first** action in `state.doneActions` per call, and the default headless action list is ordered `generate-docs → write-changelog → capture-learnings → push-and-pr → close-issue`, the test must simulate **6 calls total**: 1 to populate defaults (deferred checklist) + 3 to consume content-capture actions + 1 to consume push-and-pr + 1 to finally execute close-issue.

**Changes to `tests/hooks.test.ts`:**

1. Add `writeFileSync` to the existing `node:fs` import at the top of the file:

```typescript
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
```

2. Add a local `setupIssue` helper inside the `"onAgentEnd — deferred done checklist (#083)"` describe block:

```typescript
  function setupIssue(cwd: string) {
    const issuesDir = join(cwd, ".megapowers", "issues");
    mkdirSync(issuesDir, { recursive: true });
    writeFileSync(
      join(issuesDir, "001-test.md"),
      "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2025-01-01T00:00:00Z\n---\n# Test Issue\nDescription",
    );
  }
```

3. Add the end-to-end regression test in the same describe block:

```typescript
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
    // 1) Populate defaults (deferred checklist fires, doneActions filled, doneChecklistShown = true)
    await onAgentEnd(makeAgentEndEvent("done"), ctx as any, deps as any);
    // 2-4) Consume content-capture actions (generate-docs, write-changelog, capture-learnings)
    //      Each requires >100 chars of assistant text to be consumed
    const longText = "A".repeat(150);
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // generate-docs
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // write-changelog
    await onAgentEnd(makeAgentEndEvent(longText), ctx as any, deps as any); // capture-learnings
    // 5) Consume push-and-pr (immediate; no execGit/branch → skipped+consumed)
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);
    // 6) Now close-issue is first → executes → updateIssueStatus called → state reset
    await onAgentEnd(makeAgentEndEvent("short"), ctx as any, deps as any);
    expect(statusUpdates).toEqual([{ slug: "001-test", status: "done" }]);
    const finalState = readState(tmp);
    expect(finalState.activeIssue).toBeNull();
    expect(finalState.phase).toBeNull();
  });
```

**Verification**

Run: `bun test tests/hooks.test.ts -t "end-to-end headless"`

Expected: PASS (Tasks 2 and 4 are already implemented)

Full suite: `bun test`
Expected: all passing

### Task 6: Update reproduction tests to assert fixed behavior [no-test] [depends: 2, 3, 4]

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
