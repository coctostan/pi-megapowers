# Plan: Kill Phase Transition Popup (#072)

## AC Coverage Map

| AC | Task(s) | Description |
|----|---------|-------------|
| AC1 | Task 2 | phase_back resolves first backward transition |
| AC2 | Task 2 | phase_back from review clears reviewApproved |
| AC3 | Task 2 | phase_back from verify → implement |
| AC4 | Task 2 | phase_back from code-review → implement |
| AC5 | Task 3 | phase_back error when no backward transition |
| AC6 | Task 3 | phase_back error for bugfix workflow phases |
| AC7 | Task 4 | phase_next default skips backward transitions |
| AC8 | Task 4 | Existing phase_next behavior preserved |
| AC9 | Task 6 | onAgentEnd no longer calls handlePhaseTransition |
| AC10 | Task 6 | onAgentEnd no longer calls handleDonePhase |
| AC11 | Task 7, 8 | Done checklist widget via ctx.ui.select |
| AC12 | Task 7 | Done checklist items default to checked |
| AC13 | Task 8 | Submitting stores doneActions in state |
| AC14 | Task 8 | Dismissing stores empty doneActions |
| AC15 | Task 1 | doneMode replaced with doneActions: string[] |
| AC16 | Task 9 | Done-phase prompt reads doneActions |
| AC17 | Task 9 | All done actions are agent-driven |
| AC18 | Task 5, 11 | megapowers-protocol.md documents phase_back |
| AC19 | Task 11 | verify.md instructs phase_back |
| AC20 | Task 11 | code-review.md instructs phase_back |
| AC21 | Task 11 | review-plan.md instructs phase_back |
| AC22 | Task 10 | handlePhaseTransition removed |
| AC23 | Task 10 | handleDonePhase removed |
| AC24 | Task 10 | DONE_MODE_LABELS removed |
| AC25 | Task 1 | No remaining doneMode references |

---

### Task 1: Replace `doneMode` with `doneActions` in state types (AC15, AC25)

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/hooks.ts`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `tests/state-machine.test.ts`
- Modify: `tests/state-io.test.ts`
- Modify: `tests/ui.test.ts`
- Test: `tests/state-machine.test.ts`

**Step 1 — Write the failing test**

In `tests/state-machine.test.ts`, replace the `doneMode field` and `MegapowersState — doneMode type` describe blocks with:

```ts
describe("doneActions field", () => {
  it("initializes to empty array", () => {
    const state = createInitialState();
    expect(state.doneActions).toEqual([]);
    expect((state as any).doneMode).toBeUndefined();
  });

  it("transition resets doneActions to empty array", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "code-review",
      doneActions: ["generate-docs", "write-changelog"],
    };
    const next = transition(state, "done");
    expect(next.doneActions).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-machine.test.ts`
Expected: FAIL — Property 'doneActions' does not exist on type 'MegapowersState' (compile error)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`:
- Replace `doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | "generate-bugfix-summary" | null;` with `doneActions: string[];`
- In `createInitialState()`: replace `doneMode: null` with `doneActions: []`
- In `transition()`: replace `next.doneMode = null` with `next.doneActions = []`

In `extensions/megapowers/state/state-io.ts`:
- In `KNOWN_KEYS`: replace `"doneMode"` with `"doneActions"`

In `extensions/megapowers/ui.ts`:
- In `renderStatusText`: replace `state.doneMode` reference with `state.doneActions.length > 0 ? state.doneActions[0] : null` logic — specifically change:
  ```ts
  const modeLabel = state.doneMode ? ` → ${DONE_MODE_LABELS[state.doneMode] ?? state.doneMode}` : "";
  ```
  to:
  ```ts
  const activeDoneAction = state.doneActions.length > 0 ? state.doneActions[0] : null;
  const modeLabel = activeDoneAction ? ` → ${DONE_MODE_LABELS[activeDoneAction] ?? activeDoneAction}` : "";
  ```
- In `renderDashboardLines`: replace `state.doneMode` references similarly:
  ```ts
  if (state.phase === "done" && state.doneMode) {
    const label = DONE_MODE_LABELS[state.doneMode] ?? state.doneMode;
  ```
  to:
  ```ts
  if (state.phase === "done" && state.doneActions.length > 0) {
    const label = state.doneActions.map(a => DONE_MODE_LABELS[a] ?? a).join(", ");
  ```
- In `handleIssueCommand` (3 occurrences): replace `doneMode: null` with `doneActions: []`
- In `handleDonePhase`: replace `doneMode: "generate-docs"` → `doneActions: ["generate-docs"]`, `doneMode: "write-changelog"` → `doneActions: ["write-changelog"]`, `doneMode: "capture-learnings"` → `doneActions: ["capture-learnings"]`, `doneMode: "generate-bugfix-summary"` → `doneActions: ["generate-bugfix-summary"]`

In `extensions/megapowers/hooks.ts`:
- In `onAgentEnd` done-phase artifact capture: replace `state.doneMode` with `state.doneActions[0]` and check `state.doneActions.length > 0`:
  ```ts
  if (phase === "done" && state.doneActions.length > 0) {
    const doneAction = state.doneActions[0];
    // ... rest uses doneAction instead of state.doneMode
    if (doneAction !== "capture-learnings") {
      writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
    }
  }
  ```

In `extensions/megapowers/prompt-inject.ts`:
- Replace `state.doneMode` check with `state.doneActions.length > 0`:
  ```ts
  } else if (state.doneActions.length > 0) {
    const doneModeTemplateMap: Record<string, string> = { /* same */ };
    const filename = doneModeTemplateMap[state.doneActions[0]];
  ```

Update existing test files to compile:

In `tests/state-machine.test.ts`: remove the old `doneMode field` and `MegapowersState — doneMode type` describe blocks (replaced by new test above).

In `tests/state-io.test.ts`: replace `doneMode: null` with `doneActions: []` in the round-trip test.

In `tests/ui.test.ts`:
- Replace all `doneMode: "write-changelog"` with `doneActions: ["write-changelog"]`
- Replace all `doneMode: "generate-bugfix-summary"` with `doneActions: ["generate-bugfix-summary"]`
- Replace all `doneMode: "generate-docs"` with `doneActions: ["generate-docs"]`
- Replace all `doneMode: "capture-learnings"` with `doneActions: ["capture-learnings"]`
- Replace `result.doneMode` checks with `result.doneActions` checks (e.g. `expect(result.doneActions).toContain("generate-docs")`)
- Replace `doneMode: null` in test state setup with `doneActions: []`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except the 3 pre-existing failures in prompts.test.ts)

---

### Task 2: `phase_back` resolves backward transitions (AC1, AC2, AC3, AC4) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts`, after the existing `phase_next` describe block:

```ts
describe("phase_back", () => {
  it("transitions review → plan (first backward transition)", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
    setState(tmp, { phase: "review", reviewApproved: true });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("plan");
    expect(readState(tmp).phase).toBe("plan");
  });

  it("clears reviewApproved when going back to plan", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
    setState(tmp, { phase: "review", reviewApproved: true });
    handleSignal(tmp, "phase_back");
    expect(readState(tmp).reviewApproved).toBe(false);
  });

  it("transitions verify → implement", () => {
    setState(tmp, { phase: "verify" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("implement");
    expect(readState(tmp).phase).toBe("implement");
  });

  it("transitions code-review → implement", () => {
    setState(tmp, { phase: "code-review" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("implement");
    expect(readState(tmp).phase).toBe("implement");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: FAIL — Unknown signal action: phase_back

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

Add `import { getWorkflowConfig } from "../workflows/registry.js";` to imports.

Add `"phase_back"` case to the `handleSignal` switch:

```ts
case "phase_back":
  return handlePhaseBack(cwd, jj);
```

Add the handler function:

```ts
// ---------------------------------------------------------------------------
// phase_back
// ---------------------------------------------------------------------------

function handlePhaseBack(cwd: string, jj?: JJ): SignalResult {
  const state = readState(cwd);

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { error: "No active issue or phase." };
  }

  const config = getWorkflowConfig(state.workflow);
  const backwardTransition = config.transitions.find(
    t => t.from === state.phase && t.backward === true
  );

  if (!backwardTransition) {
    return { error: `No backward transition from ${state.phase} in ${state.workflow} workflow.` };
  }

  const result = advancePhase(cwd, backwardTransition.to, jj);
  if (!result.ok) {
    return { error: result.error };
  }

  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with ${result.newPhase} phase.`,
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 3: `phase_back` error paths (AC5, AC6) [depends: 2]

**Files:**
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to the `phase_back` describe block in `tests/tool-signal.test.ts`:

```ts
  it("returns error when no backward transition exists (brainstorm)", () => {
    setState(tmp, { phase: "brainstorm" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error when no backward transition exists (spec)", () => {
    setState(tmp, { phase: "spec" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error when no backward transition exists (plan)", () => {
    setState(tmp, { phase: "plan" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error when no backward transition exists (implement)", () => {
    setState(tmp, { phase: "implement" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error for bugfix workflow phases (no backward transitions defined)", () => {
    const bugfixPhases = ["reproduce", "diagnose", "plan", "review", "implement", "verify", "done"] as const;
    for (const phase of bugfixPhases) {
      setState(tmp, { workflow: "bugfix", phase: phase as any });
      const result = handleSignal(tmp, "phase_back");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("No backward transition");
    }
  });

  it("returns error when megaEnabled is false", () => {
    setState(tmp, { phase: "review", megaEnabled: false });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toContain("disabled");
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: PASS — all error paths already handled by the implementation in Task 2 (the `handlePhaseBack` function returns error when no backward transition found, and the `megaEnabled` check is in the top-level `handleSignal`).

Actually — these tests should pass immediately since the implementation from Task 2 already covers these cases. This is a test-only task that confirms the error paths work.

Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: PASS — all tests pass because the implementation from Task 2 already returns errors for missing backward transitions and the megaEnabled check catches the disabled case.

**Step 3 — Write minimal implementation**

No additional implementation needed — the `handlePhaseBack` function from Task 2 already:
- Returns error when `config.transitions.find(...)` returns undefined (no backward transition)
- The top-level `handleSignal` returns error when `megaEnabled` is false

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 4: `phase_next` default target skips backward transitions (AC7, AC8) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/policy/phase-advance.ts`
- Test: `tests/phase-advance.test.ts`

**Step 1 — Write the failing test**

Add to `tests/phase-advance.test.ts`:

```ts
  describe("default target skips backward transitions", () => {
    it("from verify, default target is code-review (not implement)", () => {
      setState({ phase: "verify" });
      writeArtifact("001-test", "verify.md", "# Verify\nAll good\n");
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("code-review");
    });

    it("from code-review, default target is done (not implement)", () => {
      setState({ phase: "code-review" });
      writeArtifact("001-test", "code-review.md", "# Review\nAll good\n");
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("done");
    });

    it("from review, default target is implement (not plan)", () => {
      setState({ phase: "review", reviewApproved: true });
      writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
      const result = advancePhase(tmp);
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("implement");
    });

    it("explicit backward target still works", () => {
      setState({ phase: "verify" });
      const result = advancePhase(tmp, "implement");
      expect(result.ok).toBe(true);
      expect(result.newPhase).toBe("implement");
    });
  });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-advance.test.ts --filter "default target skips backward"`
Expected: FAIL — Currently `advancePhase` with no target picks `validNext[0]` which happens to be the forward transition due to config ordering. The tests may pass by accident. To ensure the fix is explicit, we verify the implementation filters backward transitions.

Actually, due to the config ordering (forward transitions listed first), `validNext[0]` already returns the forward target. So these tests will pass with the current code. To confirm the implementation is explicit (not order-dependent), add a source verification test:

```ts
    it("advancePhase filters backward transitions explicitly (not order-dependent)", () => {
      const { readFileSync } = require("node:fs");
      const { join } = require("node:path");
      const source = readFileSync(
        join(__dirname, "..", "extensions", "megapowers", "policy", "phase-advance.ts"),
        "utf-8",
      );
      // Must explicitly filter backward transitions, not rely on array order
      expect(source).toContain("backward");
    });
```

Run: `bun test tests/phase-advance.test.ts --filter "advancePhase filters backward"`
Expected: FAIL — current phase-advance.ts does not reference "backward"

**Step 3 — Write minimal implementation**

In `extensions/megapowers/policy/phase-advance.ts`:

Add import: `import { getWorkflowConfig } from "../workflows/registry.js";`

Replace the default target resolution:

```ts
const target = targetPhase ?? validNext[0];
```

with:

```ts
let target: Phase;
if (targetPhase) {
  target = targetPhase;
} else {
  // Default: pick first non-backward transition (AC7 — skip backward transitions)
  const config = getWorkflowConfig(state.workflow);
  const forwardTransitions = config.transitions.filter(
    t => t.from === state.phase && !t.backward
  );
  target = forwardTransitions.length > 0 ? forwardTransitions[0].to : validNext[0];
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-advance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 5: Register `phase_back` in tool schema (AC18 partial) [depends: 2]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to the existing `megapowers_signal schema` describe block in `tests/tool-signal.test.ts`:

```ts
    it("includes phase_back action", () => {
      const toolsSource = readFileSync(join(process.cwd(), "extensions/megapowers/register-tools.ts"), "utf8");
      expect(toolsSource).toContain('Type.Literal("phase_back")');
    });
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back action"`
Expected: FAIL — register-tools.ts does not contain Type.Literal("phase_back")

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, in the `megapowers_signal` tool registration, add `Type.Literal("phase_back")` to the action union:

```ts
action: Type.Union([
  Type.Literal("task_done"),
  Type.Literal("review_approve"),
  Type.Literal("phase_next"),
  Type.Literal("phase_back"),
  Type.Literal("tests_failed"),
  Type.Literal("tests_passed"),
]),
```

Also update the tool description to include phase_back:

```ts
description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), review_approve (approve plan in review phase), phase_next (advance to next workflow phase), phase_back (go back to previous phase — e.g. verify→implement, code-review→implement, review→plan), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run).",
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back action"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 6: Remove popup calls from `onAgentEnd` (AC9, AC10) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts` (using source inspection since hooks.ts is integration code):

```ts
describe("onAgentEnd — popup removal (AC9, AC10)", () => {
  it("hooks.ts does not call handlePhaseTransition", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf8");
    expect(source).not.toContain("handlePhaseTransition");
  });

  it("hooks.ts does not call handleDonePhase", () => {
    const source = readFileSync(join(process.cwd(), "extensions/megapowers/hooks.ts"), "utf8");
    expect(source).not.toContain("handleDonePhase");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "popup removal"`
Expected: FAIL — hooks.ts currently contains handlePhaseTransition and handleDonePhase calls

**Step 3 — Write minimal implementation**

In `extensions/megapowers/hooks.ts`, replace the entire interactive section at the end of `onAgentEnd`:

Remove this block:
```ts
  // Interactive-only: offer phase transitions
  // Open-ended phases (brainstorm, reproduce, diagnose) suppress auto-prompts —
  // transitions happen only via explicit /phase next or megapowers_signal
  if (ctx.hasUI && !OPEN_ENDED_PHASES.has(phase)) {
    const freshState = readState(ctx.cwd);
    const validNext = getValidTransitions(freshState.workflow, phase);
    if (validNext.length > 0) {
      const newState = await ui.handlePhaseTransition(ctx, freshState, store, jj);
      writeState(ctx.cwd, newState);
    }

    // Done phase: wrap-up menu
    const afterTransition = readState(ctx.cwd);
    if (afterTransition.phase === "done") {
      const afterDone = await ui.handleDonePhase(ctx, afterTransition, store, jj);
      writeState(ctx.cwd, afterDone);
    }

    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
```

Replace with:
```ts
  // Refresh dashboard after agent turn
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
```

Also remove the now-unused imports from hooks.ts: remove `getValidTransitions` and `OPEN_ENDED_PHASES` from the import statement:
```ts
import { getValidTransitions, OPEN_ENDED_PHASES } from "./state/state-machine.js";
```
becomes (remove entirely if nothing else uses them — check for other references in the file first; `OPEN_ENDED_PHASES` is not used elsewhere in hooks.ts):
Remove the import line entirely.

Also update the done-phase artifact capture section to handle `doneActions` array:

Replace:
```ts
  if (phase === "done" && state.doneMode) {
```
with (already done in Task 1 but ensure it references `doneActions`):
```ts
  if (phase === "done" && state.doneActions.length > 0) {
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "popup removal"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 7: Done checklist items generation (AC11, AC12) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to `tests/ui.test.ts`:

```ts
import {
  renderDashboardLines,
  renderStatusText,
  formatPhaseProgress,
  formatIssueListItem,
  createUI,
  filterTriageableIssues,
  formatTriageIssueList,
  getDoneChecklistItems,
} from "../extensions/megapowers/ui.js";
```

And add test block:

```ts
describe("getDoneChecklistItems", () => {
  it("returns feature workflow items with all defaultChecked", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every(i => i.defaultChecked === true)).toBe(true);
    expect(items.map(i => i.key)).toContain("generate-docs");
    expect(items.map(i => i.key)).toContain("write-changelog");
    expect(items.map(i => i.key)).toContain("capture-learnings");
    expect(items.map(i => i.key)).toContain("close-issue");
    expect(items.map(i => i.key)).not.toContain("generate-bugfix-summary");
  });

  it("returns bugfix workflow items (bugfix summary instead of docs)", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    expect(items.map(i => i.key)).toContain("generate-bugfix-summary");
    expect(items.map(i => i.key)).not.toContain("generate-docs");
    expect(items.map(i => i.key)).toContain("write-changelog");
    expect(items.map(i => i.key)).toContain("capture-learnings");
    expect(items.map(i => i.key)).toContain("close-issue");
    expect(items.every(i => i.defaultChecked === true)).toBe(true);
  });

  it("includes squash option when taskJJChanges exist with jjChangeId", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: { 1: "abc123" },
      jjChangeId: "phase-change",
    };
    const items = getDoneChecklistItems(state);
    expect(items.map(i => i.key)).toContain("squash-task-changes");
  });

  it("excludes squash option when no taskJJChanges", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: {},
    };
    const items = getDoneChecklistItems(state);
    expect(items.map(i => i.key)).not.toContain("squash-task-changes");
  });

  it("each item has a label and key", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    for (const item of items) {
      expect(typeof item.key).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(item.key.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts --filter "getDoneChecklistItems"`
Expected: FAIL — getDoneChecklistItems is not exported from ui.ts

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, add the interface and function:

```ts
export interface DoneChecklistItem {
  key: string;
  label: string;
  defaultChecked: boolean;
}

export function getDoneChecklistItems(state: MegapowersState): DoneChecklistItem[] {
  const isBugfix = state.workflow === "bugfix";
  const items: DoneChecklistItem[] = [];

  if (isBugfix) {
    items.push({ key: "generate-bugfix-summary", label: "Generate bugfix summary", defaultChecked: true });
  } else {
    items.push({ key: "generate-docs", label: "Generate feature doc", defaultChecked: true });
  }

  items.push({ key: "write-changelog", label: "Write changelog entry", defaultChecked: true });
  items.push({ key: "capture-learnings", label: "Capture learnings", defaultChecked: true });

  const hasTaskChanges = Object.keys(state.taskJJChanges).length > 0 && state.jjChangeId;
  if (hasTaskChanges) {
    items.push({ key: "squash-task-changes", label: "Squash task changes into phase change", defaultChecked: true });
  }

  items.push({ key: "close-issue", label: "Close issue", defaultChecked: true });

  return items;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts --filter "getDoneChecklistItems"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 8: Done checklist display and state storage (AC11, AC13, AC14) [depends: 7]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to `tests/ui.test.ts`, importing `showDoneChecklist` from ui.ts:

Update the import to include `showDoneChecklist`:
```ts
import {
  // ... existing imports ...
  getDoneChecklistItems,
  showDoneChecklist,
} from "../extensions/megapowers/ui.js";
```

```ts
describe("showDoneChecklist", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "megapowers-ui-checklist-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("stores selected action keys as doneActions in state", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp, state);

    const ctx = createMockCtx(undefined, tmp);
    // Mock select to simulate user selecting specific items
    let selectCalls = 0;
    ctx.ui.select = async (_prompt: string, items: string[]) => {
      selectCalls++;
      // First call: select items to keep (simulating a multi-select via repeated select)
      // For this test, select all items (equivalent to checking all)
      if (selectCalls === 1) return "Submit";
      return null;
    };

    await showDoneChecklist(ctx as any, tmp);
    const updatedState = readState(tmp);
    expect(updatedState.doneActions.length).toBeGreaterThan(0);
    expect(updatedState.doneActions).toContain("generate-docs");
  });

  it("stores empty doneActions when dismissed", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp, state);

    const ctx = createMockCtx(undefined, tmp);
    // Mock select returns null (dismissed/Escape)
    ctx.ui.select = async () => null;

    await showDoneChecklist(ctx as any, tmp);
    const updatedState = readState(tmp);
    expect(updatedState.doneActions).toEqual([]);
  });

  it("all items default to selected (checked)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp, state);

    const ctx = createMockCtx(undefined, tmp);
    // Submit immediately without toggling = all defaults remain checked
    ctx.ui.select = async () => "Submit";

    await showDoneChecklist(ctx as any, tmp);
    const updatedState = readState(tmp);
    // All default items should be in doneActions
    expect(updatedState.doneActions).toContain("generate-docs");
    expect(updatedState.doneActions).toContain("write-changelog");
    expect(updatedState.doneActions).toContain("capture-learnings");
    expect(updatedState.doneActions).toContain("close-issue");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts --filter "showDoneChecklist"`
Expected: FAIL — showDoneChecklist is not exported from ui.ts

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, add the `showDoneChecklist` function:

```ts
export async function showDoneChecklist(ctx: any, cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state.activeIssue || state.phase !== "done") return;

  const items = getDoneChecklistItems(state);
  const selected = new Set(items.filter(i => i.defaultChecked).map(i => i.key));

  // Use select-based checklist: show items with checkmarks, allow toggling
  while (true) {
    const options = items.map(i => {
      const check = selected.has(i.key) ? "☑" : "☐";
      return `${check} ${i.label}`;
    });
    options.push("Submit");

    const choice = await ctx.ui.select("Done — select wrap-up actions:", options);
    if (!choice) {
      // Dismissed (Escape) — store empty
      writeState(cwd, { ...readState(cwd), doneActions: [] });
      return;
    }

    if (choice === "Submit") {
      writeState(cwd, { ...readState(cwd), doneActions: Array.from(selected) });
      return;
    }

    // Toggle the selected item
    const item = items.find(i => choice.includes(i.label));
    if (item) {
      if (selected.has(item.key)) {
        selected.delete(item.key);
      } else {
        selected.add(item.key);
      }
    }
  }
}
```

Add the import for `readState` and `writeState` at the top of ui.ts (they're already imported).

In `extensions/megapowers/register-tools.ts`, in the `megapowers_signal` tool execute handler, after the successful `handleSignal` call, show the done checklist when the new phase is `done`:

```ts
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const { store, jj, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
  const result = handleSignal(ctx.cwd, params.action, jj);
  if (result.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
  }

  // Show done checklist when entering done phase
  const currentState = readState(ctx.cwd);
  if (ctx.hasUI && currentState.phase === "done" && params.action === "phase_next") {
    const { showDoneChecklist } = await import("./ui.js");
    await showDoneChecklist(ctx, ctx.cwd);
  }

  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
  return { content: [{ type: "text", text: result.message ?? "OK" }], details: undefined };
},
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts --filter "showDoneChecklist"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 9: Done-phase prompt reads `doneActions` (AC16, AC17) [depends: 1, 8]

**Files:**
- Create: `prompts/done.md`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`:

```ts
describe("done phase — doneActions prompt injection", () => {
  it("injects done template listing selected actions when doneActions is non-empty", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["generate-docs", "write-changelog", "capture-learnings", "close-issue"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("generate-docs");
    expect(result).toContain("write-changelog");
    expect(result).toContain("capture-learnings");
    expect(result).toContain("close-issue");
  });

  it("injects done template even when only some actions are selected", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["write-changelog"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("write-changelog");
  });

  it("does not inject done action template when doneActions is empty", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: [],
    });
    const result = buildInjectedPrompt(tmp);
    // Should still have protocol but no action-specific template
    expect(result).not.toBeNull();
    expect(result).toContain("megapowers_signal");
    // Should NOT contain action instructions
    expect(result).not.toContain("Execute the following wrap-up actions");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts --filter "doneActions prompt"`
Expected: FAIL — done phase with doneActions does not inject the expected content (currently uses old doneMode-based template selection)

**Step 3 — Write minimal implementation**

Create `prompts/done.md`:

```md
You are executing wrap-up actions for a completed issue. Perform each action sequentially.

> **Workflow:** ... → verify → code-review → **done**

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Selected Actions
{{done_actions_list}}

## Instructions

Execute the following wrap-up actions in order. For each action:

1. **generate-docs** — Generate a feature document summarizing what was built. Save via `megapowers_save_artifact({ phase: "docs", content: "<document>" })`. The doc will be stored in `.megapowers/docs/`.

2. **generate-bugfix-summary** — Generate a bugfix summary. Save via `megapowers_save_artifact({ phase: "bugfix-summary", content: "<summary>" })`. The summary will be stored in `.megapowers/docs/`.

3. **write-changelog** — Write a changelog entry for the changes. Save via `megapowers_save_artifact({ phase: "changelog", content: "<entry>" })`. The entry will be appended to `.megapowers/CHANGELOG.md`.

4. **capture-learnings** — Reflect on the implementation and capture 2–5 learning entries. Save via `megapowers_save_artifact({ phase: "learnings", content: "<markdown list>" })`.

5. **squash-task-changes** — Run `jj squash` to consolidate per-task changes into the phase change.

6. **close-issue** — The issue will be closed automatically when all actions are complete.

Only execute the actions listed above in **Selected Actions**. Skip any action not in the list.

## Learnings
{{learnings}}
```

In `extensions/megapowers/prompts.ts`, update `PHASE_PROMPT_MAP` to use `done.md` for the done phase:

```ts
done: "done.md",
```

In `extensions/megapowers/prompt-inject.ts`, replace the done-phase template logic:

Replace:
```ts
  } else if (state.doneActions.length > 0) {
    const doneModeTemplateMap: Record<string, string> = {
      "generate-docs": "generate-docs.md",
      "capture-learnings": "capture-learnings.md",
      "write-changelog": "write-changelog.md",
      "generate-bugfix-summary": "generate-bugfix-summary.md",
    };
    const filename = doneModeTemplateMap[state.doneActions[0]];
    if (filename) {
      const template = loadPromptFile(filename);
      if (template) {
        const phasePrompt = interpolatePrompt(template, vars);
        if (phasePrompt) parts.push(phasePrompt);
      }
    }
  }
```

With:
```ts
  } else if (state.doneActions.length > 0) {
    // Build done actions list for template interpolation
    vars.done_actions_list = state.doneActions.map(a => `- ${a}`).join("\n");
    const template = getPhasePromptTemplate("done");
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  }
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts --filter "doneActions prompt"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing)

---

### Task 10: Remove `handlePhaseTransition`, `handleDonePhase`, `DONE_MODE_LABELS` + update `/done` command (AC22, AC23, AC24) [depends: 6, 7, 8]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/ui.test.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to `tests/ui.test.ts`:

```ts
describe("dead code removal (AC22, AC23, AC24)", () => {
  it("ui.ts does not export handlePhaseTransition", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "ui.ts"),
      "utf-8",
    );
    expect(source).not.toContain("handlePhaseTransition");
  });

  it("ui.ts does not export handleDonePhase", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "ui.ts"),
      "utf-8",
    );
    expect(source).not.toContain("handleDonePhase");
  });

  it("ui.ts does not export DONE_MODE_LABELS", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const source = readFileSync(
      join(__dirname, "..", "extensions", "megapowers", "ui.ts"),
      "utf-8",
    );
    expect(source).not.toContain("DONE_MODE_LABELS");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts --filter "dead code removal"`
Expected: FAIL — ui.ts still contains handlePhaseTransition, handleDonePhase, DONE_MODE_LABELS

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`:

1. Delete the `DONE_MODE_LABELS` constant entirely.

2. In `renderStatusText`: replace the DONE_MODE_LABELS reference. Since DONE_MODE_LABELS is gone, simplify to:
   ```ts
   const modeLabel = state.doneActions.length > 0 ? ` → ${state.doneActions.length} actions` : "";
   ```

3. In `renderDashboardLines`: replace the DONE_MODE_LABELS reference:
   ```ts
   if (state.phase === "done" && state.doneActions.length > 0) {
     lines.push(`${theme.fg("accent", "Actions:")} ${state.doneActions.length} wrap-up actions selected`);
     lines.push(theme.fg("dim", "Send any message to execute wrap-up actions."));
   }
   ```

4. Remove `handlePhaseTransition` from the `MegapowersUI` interface:
   Delete:
   ```ts
   handlePhaseTransition(
     ctx: ExtensionContext,
     state: MegapowersState,
     store: Store,
     jj: JJ
   ): Promise<MegapowersState>;
   ```

5. Remove `handleDonePhase` from the `MegapowersUI` interface:
   Delete:
   ```ts
   handleDonePhase(
     ctx: ExtensionContext,
     state: MegapowersState,
     store: Store,
     jj: JJ
   ): Promise<MegapowersState>;
   ```

6. Remove the `handlePhaseTransition` method implementation from `createUI()` return object — delete the entire `async handlePhaseTransition(ctx, state, store, jj) { ... }` block.

7. Remove the `handleDonePhase` method implementation from `createUI()` return object — delete the entire `async handleDonePhase(ctx, state, store, jj) { ... }` block.

8. Remove now-unused imports: `checkGate` from `"./policy/gates.js"`, `formatChangeDescription` from `"./jj.js"` (if no longer used), `getValidTransitions`, `transition` from `"./state/state-machine.js"` (check if other code still uses them).

In `extensions/megapowers/commands.ts`:

Update `handleDoneCommand` to use `showDoneChecklist` instead of `handleDonePhase`:

```ts
import { showDoneChecklist } from "./ui.js";

export async function handleDoneCommand(_args: string, ctx: any, deps: Deps): Promise<void> {
  const state = readState(ctx.cwd);
  if (state.phase !== "done") {
    if (ctx.hasUI) ctx.ui.notify("Not in done phase. Use /phase next to advance.", "info");
    return;
  }

  await showDoneChecklist(ctx, ctx.cwd);
  if (ctx.hasUI) deps.ui.renderDashboard(ctx, readState(ctx.cwd), deps.store);
}
```

In `tests/ui.test.ts`:

Delete the following test describe blocks entirely (they test removed functions):
- `"handlePhaseTransition — gate enforcement"`
- `"handlePhaseTransition — post-transition guidance"`
- `"handleDonePhase"` (the main block)
- `"handleDonePhase — doneMode actions"` 
- `"handleDonePhase — bugfix workflow"`
- `"handleDonePhase — batch auto-close"`

Also update imports in tests/ui.test.ts: remove `createUI` from the import if no other tests use it. Actually, `createUI` is still used by other tests (handleIssueCommand, handleTriageCommand), so keep it.

Remove `DONE_MODE_LABELS` from the import if it was imported in tests.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts --filter "dead code removal"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing (except 3 pre-existing). Many previously-existing tests that tested handlePhaseTransition and handleDonePhase are now deleted (not failing — deleted).

---

### Task 11: Update prompt files for `phase_back` (AC18, AC19, AC20, AC21) [no-test]

**Justification:** These are prompt/instruction file changes. Prompt files are markdown that instruct the LLM — they have no programmatic behavior to unit test.

**Files:**
- Modify: `prompts/megapowers-protocol.md`
- Modify: `prompts/verify.md`
- Modify: `prompts/code-review.md`
- Modify: `prompts/review-plan.md`

**Step 1 — Make the changes**

In `prompts/megapowers-protocol.md`, add `phase_back` to the tool reference section:

After the `phase_next` entry, add:
```md
- `{ action: "phase_back" }` — Go back to previous phase (e.g. verify→implement, code-review→implement, review→plan). Only works when a backward transition exists from the current phase.
```

In `prompts/verify.md`:

Replace:
```md
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap). The user will need to use `/phase implement` or `/phase plan` to transition back.
```

With:
```md
- If any criterion fails: explain what's missing. For small fixes, call `megapowers_signal({ action: "phase_back" })` to go back to implement. For bigger gaps requiring plan changes, recommend the user use `/phase plan` to transition back.
```

In `prompts/code-review.md`:

Replace the "If **needs-rework**" section:
```md
### If **needs-rework**
Structural problems that can't be patched (wrong abstraction, missing component, broken architecture). Don't try to fix inline:
1. Save the review report with detailed findings
2. Recommend going back to **implement** (fixable with targeted task changes) or **plan** (fundamental design issue)
3. Present the recommendation to the user — they will need to use `/phase implement` or `/phase plan` to transition back
```

With:
```md
### If **needs-rework**
Structural problems that can't be patched (wrong abstraction, missing component, broken architecture). Don't try to fix inline:
1. Save the review report with detailed findings
2. Call `megapowers_signal({ action: "phase_back" })` to go back to **implement** for targeted fixes
3. For fundamental design issues requiring plan changes, recommend the user use `/phase plan` to transition back
```

In `prompts/review-plan.md`:

Replace:
```md
If the plan needs revision, present specific feedback to the user. When confirmed, the plan phase will need to be revisited.
```

With:
```md
If the plan needs revision, present specific feedback to the user. When confirmed, call `megapowers_signal({ action: "phase_back" })` to go back to the plan phase for rework.
```

**Step 2 — Verify**
Run: `bun test`
Expected: All passing (except 3 pre-existing). Prompt changes don't affect test execution.

Verify content manually:
```bash
grep -n "phase_back" prompts/megapowers-protocol.md prompts/verify.md prompts/code-review.md prompts/review-plan.md
```
Expected: Each file contains at least one reference to `phase_back`.
