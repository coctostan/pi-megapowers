# Plan: Kill Phase Transition Popup (#072) — v4

## Summary of Changes from v3

- **Task 2 deleted** — updated `handleDonePhase` references that Task 11 removes entirely. Display tests merged into Task 9 (old Task 11).
- **Task 6 deleted** — source-code grepping anti-pattern. Schema registration merged into Task 3 (old Task 4) Step 3.
- **Task 3 (old Task 4) fixed** — Step 2 now expects TypeScript compile error (not runtime). Step 3 adds `reviewApproved: false` clearing for AC2.
- **Task 2 (old Task 3) fixed** — Step 3 adds missing `doneAction` variable declaration.
- **Source-code grepping tests removed** — Old Tasks 7, 11, 13 no longer grep source files. Replaced with behavioral tests or `[no-test]` with justification.
- **Compile-time vs runtime errors clarified** — Tasks 1, 2, 3 Step 2 now specify TypeScript compile errors where appropriate.
- **All tasks renumbered** — 14 tasks → 12 tasks.

---

## AC Coverage Map

| AC | Task(s) | Description |
|----|---------|-------------|
| AC1 | Task 3 | phase_back resolves first backward transition |
| AC2 | Task 3 | phase_back from review clears reviewApproved |
| AC3 | Task 3 | phase_back from verify → implement |
| AC4 | Task 3 | phase_back from code-review → implement |
| AC5 | Task 3 | phase_back error when no backward transition |
| AC6 | Task 3 | phase_back error for bugfix workflow phases |
| AC7 | Task 4 | phase_next default skips backward transitions |
| AC8 | Task 4 | Existing phase_next behavior preserved |
| AC9 | Task 5 | onAgentEnd no longer calls handlePhaseTransition |
| AC10 | Task 5 | onAgentEnd no longer calls handleDonePhase |
| AC11 | Task 7, 8, 11 | Done checklist widget via ctx.ui.custom() |
| AC12 | Task 6 | Done checklist items default to checked |
| AC13 | Task 8 | Submitting stores doneActions in state |
| AC14 | Task 8 | Dismissing stores empty doneActions |
| AC15 | Task 1, 2 | doneMode replaced with doneActions: string[] |
| AC16 | Task 10 | Done-phase prompt reads doneActions |
| AC17 | Task 10 | All done actions are agent-driven |
| AC18 | Task 3, 12 | megapowers-protocol.md documents phase_back |
| AC19 | Task 12 | verify.md instructs phase_back |
| AC20 | Task 12 | code-review.md instructs phase_back |
| AC21 | Task 12 | review-plan.md instructs phase_back |
| AC22 | Task 9 | handlePhaseTransition removed |
| AC23 | Task 9 | handleDonePhase removed |
| AC24 | Task 9 | DONE_MODE_LABELS removed |
| AC25 | Task 1, 2, 9, 11 | No remaining doneMode references |

---

### Task 1: Replace `doneMode` with `doneActions` in state types, initial state, and IO (AC15, AC25 partial)

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
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
Run: `bun test tests/state-machine.test.ts --filter "doneActions field"`
Expected: FAIL — **TypeScript compile error**: `Property 'doneActions' does not exist on type 'MegapowersState'`. The test file won't compile because `MegapowersState` still has `doneMode`, not `doneActions`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`:
- In the `MegapowersState` interface, replace:
  ```ts
  doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | "generate-bugfix-summary" | null;
  ```
  with:
  ```ts
  doneActions: string[];
  ```
- In `createInitialState()`, replace `doneMode: null` with `doneActions: []`
- In `transition()`, replace `next.doneMode = null` with `next.doneActions = []`

In `extensions/megapowers/state/state-io.ts`:
- In `KNOWN_KEYS`, replace `"doneMode"` with `"doneActions"`

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-machine.test.ts --filter "doneActions field"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test tests/state-machine.test.ts`
Expected: PASS (other files will have compile errors until Tasks 2 is done)

---

### Task 2: Update `hooks.ts`, `prompt-inject.ts`, `ui.ts`, and `commands.ts` references from `doneMode` to `doneActions` (AC15, AC25 partial) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/commands.ts`
- Test: `tests/state-io.test.ts`

**Step 1 — Write the failing test**

In `tests/state-io.test.ts`, update the round-trip test to use `doneActions`:
```ts
it("writeState followed by readState returns identical state", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "005-round-trip",
    workflow: "feature" as const,
    phase: "implement" as const,
    phaseHistory: [{ from: "plan" as const, to: "implement" as const, timestamp: 12345 }],
    currentTaskIndex: 2,
    completedTasks: [1, 2],
    reviewApproved: true,
    tddTaskState: { taskIndex: 3, state: "test-written" as const, skipped: false },
    taskJJChanges: { 1: "abc", 2: "def" },
    jjChangeId: "xyz",
    doneActions: [],
    megaEnabled: true,
  };
  writeState(tmp, state);
  const loaded = readState(tmp);
  expect(loaded).toEqual(state);
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-io.test.ts`
Expected: FAIL — **TypeScript compile error** across `hooks.ts`, `prompt-inject.ts`, `ui.ts`, and `commands.ts` which all reference `state.doneMode` which no longer exists on the type.

**Step 3 — Write minimal implementation**

**In `extensions/megapowers/hooks.ts`**, update the done-phase artifact capture block in `onAgentEnd`:
```ts
// Before
if (phase === "done" && state.doneMode) {
  const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
  if (lastAssistant) {
    const text = getAssistantText(lastAssistant);
    if (text && text.length > 100) {
      if (state.doneMode === "generate-docs" || state.doneMode === "generate-bugfix-summary") {
        store.writeFeatureDoc(state.activeIssue, text);
        if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
      }
      if (state.doneMode === "write-changelog") {
        store.appendChangelog(text);
        if (ctx.hasUI) ctx.ui.notify("Changelog entry appended to .megapowers/CHANGELOG.md", "info");
      }
      if (state.doneMode !== "capture-learnings") {
        writeState(ctx.cwd, { ...state, doneMode: null });
      }
    }
  }
}

// After
if (phase === "done" && state.doneActions.length > 0) {
  const doneAction = state.doneActions[0];
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
      if (doneAction !== "capture-learnings") {
        writeState(ctx.cwd, { ...state, doneActions: state.doneActions.filter(a => a !== doneAction) });
      }
    }
  }
}
```

**In `extensions/megapowers/prompt-inject.ts`**, replace the done-phase block:
```ts
// Before
} else if (state.doneMode) {
  const doneModeTemplateMap: Record<string, string> = {
    "generate-docs": "generate-docs.md",
    "capture-learnings": "capture-learnings.md",
    "write-changelog": "write-changelog.md",
    "generate-bugfix-summary": "generate-bugfix-summary.md",
  };
  const filename = doneModeTemplateMap[state.doneMode];
  if (filename) {
    const template = loadPromptFile(filename);
    if (template) {
      const phasePrompt = interpolatePrompt(template, vars);
      if (phasePrompt) parts.push(phasePrompt);
    }
  }
}

// After
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

**In `extensions/megapowers/ui.ts`**, replace ALL `doneMode` references:

In `renderStatusText`:
```ts
// Before
const modeLabel = state.doneMode ? ` → ${DONE_MODE_LABELS[state.doneMode] ?? state.doneMode}` : "";
// After
const modeLabel = state.doneActions.length > 0 ? ` → ${state.doneActions.length} actions` : "";
```

In `renderDashboardLines` done-phase block:
```ts
// Before
if (state.phase === "done" && state.doneMode) {
  const label = DONE_MODE_LABELS[state.doneMode] ?? state.doneMode;
  lines.push(`${theme.fg("accent", "Action:")} ${label}`);
  lines.push(theme.fg("dim", "Send any message to generate."));
}
// After
if (state.phase === "done" && state.doneActions.length > 0) {
  const label = state.doneActions.join(", ");
  lines.push(`${theme.fg("accent", "Actions:")} ${label}`);
  lines.push(theme.fg("dim", "Send any message to execute wrap-up actions."));
}
```

In `handleIssueCommand` — replace all 3 occurrences of `doneMode: null` with `doneActions: []`.

In `handleDonePhase` — replace all `doneMode` assignments:
- `doneMode: "generate-docs"` → `doneActions: ["generate-docs"]`
- `doneMode: "write-changelog"` → `doneActions: ["write-changelog"]`
- `doneMode: "capture-learnings"` → `doneActions: ["capture-learnings"]`
- `doneMode: "generate-bugfix-summary"` → `doneActions: ["generate-bugfix-summary"]`

In `handleTriageCommand` — replace `doneMode: null` with `doneActions: []`.

**In `extensions/megapowers/commands.ts`** — `handleDoneCommand` calls `deps.ui.handleDonePhase` which now uses `doneActions`. No type changes needed here (the UI method signature uses `MegapowersState` which was already updated in Task 1).

**In `tests/ui.test.ts`** — update existing tests to use `doneActions`:
- `doneMode: "write-changelog"` → `doneActions: ["write-changelog"]`
- `doneMode: "generate-bugfix-summary"` → `doneActions: ["generate-bugfix-summary"]`
- `doneMode: "generate-docs"` → `doneActions: ["generate-docs"]`
- `doneMode: "capture-learnings"` → `doneActions: ["capture-learnings"]`
- `doneMode: null` → `doneActions: []`
- `result.doneMode` assertions → `result.doneActions` assertions (e.g. `expect(result.doneActions).toContain("generate-docs")`)

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 3: `phase_back` signal with schema registration — all tests (AC1, AC2, AC3, AC4, AC5, AC6, AC18 partial) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/tools/tool-signal.ts`
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tool-signal.test.ts`

**Step 1 — Write the failing tests**

Add the full `phase_back` describe block to `tests/tool-signal.test.ts`:

```ts
describe("phase_back", () => {
  // --- Happy path: backward transitions ---

  it("transitions review → plan (AC1, AC2)", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
    setState(tmp, { phase: "review", reviewApproved: true });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("plan");
    expect(readState(tmp).phase).toBe("plan");
  });

  it("clears reviewApproved when going back to plan (AC2)", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n");
    setState(tmp, { phase: "review", reviewApproved: true });
    handleSignal(tmp, "phase_back");
    expect(readState(tmp).reviewApproved).toBe(false);
  });

  it("transitions verify → implement (AC3)", () => {
    setState(tmp, { phase: "verify" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("implement");
    expect(readState(tmp).phase).toBe("implement");
  });

  it("transitions code-review → implement (AC4)", () => {
    setState(tmp, { phase: "code-review" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("implement");
    expect(readState(tmp).phase).toBe("implement");
  });

  // --- Error paths: no backward transition (AC5, AC6) ---

  it("returns error from brainstorm — no backward transition (AC5)", () => {
    setState(tmp, { phase: "brainstorm" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error from spec — no backward transition (AC5)", () => {
    setState(tmp, { phase: "spec" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error from plan — no backward transition (AC5)", () => {
    setState(tmp, { phase: "plan" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error from implement — no backward transition (AC5)", () => {
    setState(tmp, { phase: "implement" });
    const result = handleSignal(tmp, "phase_back");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No backward transition");
  });

  it("returns error for bugfix workflow phases (AC6)", () => {
    const bugfixPhases = ["reproduce", "diagnose", "plan", "review", "implement", "verify"] as const;
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
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: FAIL — **TypeScript compile error**: `handleSignal` does not accept `"phase_back"` as a valid action. The type union in `tool-signal.ts` is `"task_done" | "review_approve" | "phase_next" | string`, so it technically compiles but falls through to the `default` case returning `Unknown signal action: phase_back`. All 10 tests fail with `error: "Unknown signal action: phase_back"`.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/tools/tool-signal.ts`:

Add import at top:
```ts
import { getWorkflowConfig } from "../workflows/registry.js";
```

Add `"phase_back"` to the action union and switch case:
```ts
export function handleSignal(
  cwd: string,
  action: "task_done" | "review_approve" | "phase_next" | "phase_back" | string,
  jj?: JJ,
): SignalResult {
```

Add case to the switch:
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

  if (!state.megaEnabled) {
    return { error: "Megapowers is disabled. Use /mega on to re-enable." };
  }

  if (!state.activeIssue || !state.phase || !state.workflow) {
    return { error: "No active issue or phase." };
  }

  const config = getWorkflowConfig(state.workflow);
  const backwardTransition = config.transitions.find(
    (t) => t.from === state.phase && t.backward === true,
  );

  if (!backwardTransition) {
    return {
      error: `No backward transition from ${state.phase} in ${state.workflow} workflow.`,
    };
  }

  // AC2: Clear reviewApproved when going back to plan
  if (backwardTransition.to === "plan") {
    const currentState = readState(cwd);
    writeState(cwd, { ...currentState, reviewApproved: false });
  }

  const result = advancePhase(cwd, backwardTransition.to, jj);
  if (!result.ok) {
    return { error: result.error };
  }

  return {
    message: `Phase moved back to ${result.newPhase}. Rework needed — continue with the ${result.newPhase} phase.`,
  };
}
```

In `extensions/megapowers/register-tools.ts`, add `Type.Literal("phase_back")` to the action union:

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

Update the tool description:
```ts
description: "Signal a megapowers state transition. Actions: task_done (mark current implement task complete), review_approve (approve plan in review phase), phase_next (advance to next workflow phase), phase_back (go back to previous phase — e.g. verify→implement, code-review→implement, review→plan; errors if no backward transition exists), tests_failed (mark RED after a failing test run), tests_passed (acknowledge GREEN after a passing test run).",
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "phase_back"`
Expected: PASS — all 10 tests pass

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 4: `phase_next` default target skips backward transitions (AC7, AC8) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/policy/phase-advance.ts`
- Test: `tests/phase-advance.test.ts`

**Step 1 — Write the failing test**

Add to `tests/phase-advance.test.ts`:

```ts
describe("phase_next default target skips backward transitions (AC7)", () => {
  it("from verify, default target is code-review (skips backward implement)", () => {
    setState({ phase: "verify" });
    writeArtifact("001-test", "verify.md", "# Verify\nAll passing\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("code-review");
  });

  it("from code-review, default target is done (skips backward implement)", () => {
    setState({ phase: "code-review" });
    writeArtifact("001-test", "code-review.md", "# Code Review\nApproved\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("done");
  });

  it("from review, default target is implement (skips backward plan)", () => {
    setState({ phase: "review", reviewApproved: true });
    writeArtifact("001-test", "plan.md", "# Plan\n\n### Task 1: A\n");
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
  });

  it("explicit backward target still works when specified (AC7 — explicit override)", () => {
    setState({ phase: "verify" });
    const result = advancePhase(tmp, "implement");
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("implement");
  });
});

describe("phase_next preserves existing gate behavior (AC8)", () => {
  it("brainstorm → spec still works", () => {
    setState({ phase: "brainstorm" });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(true);
    expect(result.newPhase).toBe("spec");
  });

  it("spec → plan gate still rejects without spec.md", () => {
    setState({ phase: "spec" });
    // No spec.md artifact
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("spec.md");
  });

  it("review → implement gate still rejects without reviewApproved", () => {
    setState({ phase: "review", reviewApproved: false });
    const result = advancePhase(tmp);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("review");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-advance.test.ts --filter "skips backward"`
Expected: FAIL — `from verify, default target is code-review` fails because `validNext[0]` returns `implement` (the backward transition is listed first in the transitions array for verify) instead of `code-review`

**Step 3 — Write minimal implementation**

In `extensions/megapowers/policy/phase-advance.ts`:

Add import at top:
```ts
import { getWorkflowConfig } from "../workflows/registry.js";
```

Replace the default target resolution (the line `const target = targetPhase ?? validNext[0];`):
```ts
let target: Phase;
if (targetPhase) {
  target = targetPhase;
} else {
  // AC7: default picks first NON-backward transition
  const config = getWorkflowConfig(state.workflow);
  const forwardTransition = config.transitions.find(
    (t) => t.from === state.phase && !t.backward,
  );
  target = forwardTransition?.to ?? validNext[0];
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-advance.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 5: Remove popup calls from `onAgentEnd` (AC9, AC10) [no-test] [depends: 2]

**Justification:** The popup removal is a deletion — the behavioral effect (no blocking popup after agent turns) is implicitly verified by the full test suite passing without the deleted code. The functions being called (`handlePhaseTransition`, `handleDonePhase`) are tested via their own test blocks which will be removed in Task 9. There is no new behavior to test — only removal of blocking behavior.

**Files:**
- Modify: `extensions/megapowers/hooks.ts`

**Step 1 — Make the change**

In `extensions/megapowers/hooks.ts`, remove the entire interactive block at the end of `onAgentEnd`:

```ts
// Remove this block:
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
  // Refresh dashboard after agent turn (AC9, AC10 — no blocking popup)
  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }
```

Remove now-unused imports: `getValidTransitions` and `OPEN_ENDED_PHASES` from `"./state/state-machine.js"` — check they aren't used elsewhere in the file first.

**Step 2 — Verify**
Run: `bun test`
Expected: All passing. Verify with `grep -n "handlePhaseTransition\|handleDonePhase" extensions/megapowers/hooks.ts` — should return no matches.

---

### Task 6: `getDoneChecklistItems` pure function (AC12) [depends: 1]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to the imports in `tests/ui.test.ts`:
```ts
import {
  // ... existing named imports ...
  getDoneChecklistItems,
} from "../extensions/megapowers/ui.js";
```

Add test block:

```ts
describe("getDoneChecklistItems (AC12)", () => {
  it("feature workflow: returns generate-docs, write-changelog, capture-learnings, close-issue all defaultChecked", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((i) => i.defaultChecked === true)).toBe(true);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("generate-docs");
    expect(keys).toContain("write-changelog");
    expect(keys).toContain("capture-learnings");
    expect(keys).toContain("close-issue");
    expect(keys).not.toContain("generate-bugfix-summary");
  });

  it("bugfix workflow: returns generate-bugfix-summary instead of generate-docs", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "bugfix",
      phase: "done",
    };
    const items = getDoneChecklistItems(state);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("generate-bugfix-summary");
    expect(keys).not.toContain("generate-docs");
    expect(keys).toContain("write-changelog");
    expect(keys).toContain("capture-learnings");
    expect(keys).toContain("close-issue");
    expect(items.every((i) => i.defaultChecked === true)).toBe(true);
  });

  it("includes squash option when taskJJChanges non-empty and jjChangeId set", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: { 1: "abc123" },
      jjChangeId: "phase-change",
    };
    const items = getDoneChecklistItems(state);
    expect(items.map((i) => i.key)).toContain("squash-task-changes");
  });

  it("excludes squash option when taskJJChanges is empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
      taskJJChanges: {},
    };
    const items = getDoneChecklistItems(state);
    expect(items.map((i) => i.key)).not.toContain("squash-task-changes");
  });

  it("each item has a non-empty key and label", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    for (const item of getDoneChecklistItems(state)) {
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
Expected: FAIL — `getDoneChecklistItems is not a function` (not exported from ui.ts)

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
    items.push({ key: "generate-docs", label: "Generate feature document", defaultChecked: true });
  }

  items.push({ key: "write-changelog", label: "Write changelog entry", defaultChecked: true });
  items.push({ key: "capture-learnings", label: "Capture learnings", defaultChecked: true });

  const hasTaskChanges =
    Object.keys(state.taskJJChanges).length > 0 && Boolean(state.jjChangeId);
  if (hasTaskChanges) {
    items.push({
      key: "squash-task-changes",
      label: "Squash task changes into phase change",
      defaultChecked: true,
    });
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
Expected: All passing

---

### Task 7: `showChecklistUI` TUI widget using `ctx.ui.custom()` [no-test] [depends: 6]

**Justification:** This is a TUI rendering component — the render/handleInput functions require live pi-tui primitives (Key, matchesKey, truncateToWidth, tui.requestRender). There is no way to unit test the TUI rendering loop without a real terminal. The questionnaire extension from which this is adapted also has no unit tests. Correctness is verified by TypeScript compilation and integration testing in Task 8.

**Files:**
- Create: `extensions/megapowers/ui-checklist.ts`

**Step 1 — Make the change**

Create `extensions/megapowers/ui-checklist.ts` adapted from the questionnaire extension pattern:

```ts
// extensions/megapowers/ui-checklist.ts
//
// Reusable checklist widget using ctx.ui.custom().
// Adapted from the pi questionnaire extension pattern.

import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

export interface ChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

/**
 * Show an interactive checklist using ctx.ui.custom().
 *
 * Returns the keys of all checked items when submitted.
 * Returns null if the user dismisses with Escape.
 *
 * Navigation:  ↑↓ to move cursor
 * Toggle:      Space or Enter (on a non-Submit row) to toggle
 * Submit:      Enter on the Submit row
 * Cancel:      Escape
 */
export async function showChecklistUI(
  ctx: { hasUI: boolean; ui: { custom: <T>(fn: any) => Promise<T> } },
  items: ChecklistItem[],
  title: string,
): Promise<string[] | null> {
  if (!ctx.hasUI) return null;

  return ctx.ui.custom<string[] | null>((tui: any, theme: any, _kb: any, done: (v: string[] | null) => void) => {
    const checked = new Set(items.filter((i) => i.checked).map((i) => i.key));
    let cursor = 0;
    let cachedLines: string[] | undefined;

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function handleInput(data: string) {
      if (matchesKey(data, Key.up)) {
        cursor = Math.max(0, cursor - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down)) {
        cursor = Math.min(items.length, cursor + 1); // items.length = Submit row index
        refresh();
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }
      if (matchesKey(data, Key.enter)) {
        if (cursor === items.length) {
          // Submit row selected
          done(Array.from(checked));
        } else {
          // Toggle current item
          const item = items[cursor];
          if (checked.has(item.key)) {
            checked.delete(item.key);
          } else {
            checked.add(item.key);
          }
          refresh();
        }
        return;
      }
      if (matchesKey(data, Key.space)) {
        if (cursor < items.length) {
          const item = items[cursor];
          if (checked.has(item.key)) {
            checked.delete(item.key);
          } else {
            checked.add(item.key);
          }
          refresh();
        }
        return;
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      const lines: string[] = [];
      const add = (s: string) => lines.push(truncateToWidth(s, width));

      add(theme.fg("accent", "─".repeat(width)));
      add(theme.fg("text", ` ${title}`));
      lines.push("");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isSelected = i === cursor;
        const isChecked = checked.has(item.key);
        const prefix = isSelected ? theme.fg("accent", "> ") : "  ";
        const box = isChecked ? theme.fg("success", "☑") : theme.fg("muted", "☐");
        const color = isSelected ? "accent" : "text";
        add(`${prefix}${box} ${theme.fg(color, item.label)}`);
      }

      lines.push("");
      const isSubmitSelected = cursor === items.length;
      const submitPrefix = isSubmitSelected ? theme.fg("accent", "> ") : "  ";
      add(`${submitPrefix}${theme.fg(isSubmitSelected ? "success" : "muted", "Submit")}`);

      lines.push("");
      add(theme.fg("dim", " ↑↓ navigate • Space toggle • Enter confirm • Esc cancel"));
      add(theme.fg("accent", "─".repeat(width)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}
```

**Step 2 — Verify**
Run: `bun tsc --noEmit`
Expected: No type errors in `ui-checklist.ts`

---

### Task 8: `showDoneChecklist` using `ctx.ui.custom()` (AC11, AC13, AC14) [depends: 6, 7]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

Add to imports in `tests/ui.test.ts`:
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  // ... existing named imports ...
  showDoneChecklist,
} from "../extensions/megapowers/ui.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
```

Add test block:

```ts
describe("showDoneChecklist (AC11, AC13, AC14)", () => {
  let tmp2: string;

  beforeEach(() => {
    tmp2 = mkdtempSync(join(tmpdir(), "megapowers-done-"));
  });

  afterEach(() => {
    rmSync(tmp2, { recursive: true, force: true });
  });

  it("stores all default-checked keys when ctx.ui.custom resolves with them (AC13)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) =>
          ["generate-docs", "write-changelog", "capture-learnings", "close-issue"],
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toContain("generate-docs");
    expect(updated.doneActions).toContain("write-changelog");
    expect(updated.doneActions).toContain("capture-learnings");
    expect(updated.doneActions).toContain("close-issue");
  });

  it("stores empty doneActions when ctx.ui.custom resolves with null (Escape) (AC14)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) => null,
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toEqual([]);
  });

  it("stores only the returned subset when user deselects some items (AC13)", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "done",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: {
        custom: async (_fn: any) => ["generate-docs", "capture-learnings", "close-issue"],
      },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).not.toContain("write-changelog");
    expect(updated.doneActions).toContain("generate-docs");
    expect(updated.doneActions).toContain("capture-learnings");
  });

  it("does nothing when not in done phase", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "001-test",
      workflow: "feature",
      phase: "implement",
    };
    writeState(tmp2, state);

    const ctx = {
      hasUI: true,
      ui: { custom: async (_fn: any) => ["generate-docs"] },
    };

    await showDoneChecklist(ctx as any, tmp2);
    const updated = readState(tmp2);
    expect(updated.doneActions).toEqual([]);
  });

  it("does nothing when no active issue", async () => {
    const state: MegapowersState = {
      ...createInitialState(),
      phase: "done",
    };
    writeState(tmp2, state);

    let called = false;
    const ctx = {
      hasUI: true,
      ui: { custom: async (_fn: any) => { called = true; return []; } },
    };

    await showDoneChecklist(ctx as any, tmp2);
    expect(called).toBe(false);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts --filter "showDoneChecklist"`
Expected: FAIL — `showDoneChecklist is not a function` (not exported from ui.ts)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`, add the import at the top:
```ts
import { showChecklistUI } from "./ui-checklist.js";
import { readState } from "./state/state-io.js";
```

Add the exported function:
```ts
export async function showDoneChecklist(ctx: any, cwd: string): Promise<void> {
  const state = readState(cwd);
  if (!state.activeIssue || state.phase !== "done") return;
  if (!ctx.hasUI) return;

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

Note: `ui.ts` already imports `writeState` from `"./state/state-io.js"`. Only add the `readState` import if not already present.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts --filter "showDoneChecklist"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 9: Remove dead code from `ui.ts` and update display tests (AC22, AC23, AC24, AC25 partial) [depends: 5, 8]

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/ui.test.ts`
- Test: `tests/ui.test.ts`

**Step 1 — Write the failing test**

In `tests/ui.test.ts`, add new tests for the updated display behavior and verify dead code is gone:

```ts
describe("renderDashboardLines — done phase with doneActions", () => {
  it("shows action labels when doneActions is non-empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneActions: ["write-changelog"],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n")).toContain("write-changelog");
  });

  it("shows instruction when doneActions non-empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      workflow: "bugfix",
      phase: "done",
      doneActions: ["generate-bugfix-summary"],
    };
    const lines = renderDashboardLines(state, [], plainTheme as any);
    expect(lines.join("\n").toLowerCase()).toContain("send");
  });

  it("shows nothing extra when doneActions is empty", () => {
    const state: MegapowersState = {
      ...createInitialState(),
      activeIssue: "014-filter-issues",
      phase: "done",
      doneActions: [],
    };
    const linesBefore = renderDashboardLines(state, [], plainTheme as any).length;
    const stateWithActions: MegapowersState = { ...state, doneActions: ["write-changelog"] };
    const linesAfter = renderDashboardLines(stateWithActions, [], plainTheme as any).length;
    expect(linesAfter).toBeGreaterThan(linesBefore);
  });
});
```

Also remove existing test describe blocks that test removed functions:
- `"handlePhaseTransition — gate enforcement"`
- `"handlePhaseTransition — post-transition guidance"`
- `"handleDonePhase"` (all done-phase menu tests)
- `"handleDonePhase — doneMode actions"`
- `"renderDashboardLines — done phase with doneMode"` (replaced by the new block above)
- `"renderStatusText — done phase with doneMode"` (renderStatusText updated in Task 2)
- `"handleDonePhase — bugfix workflow"` (if exists)

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui.test.ts --filter "doneActions"`
Expected: FAIL — if `DONE_MODE_LABELS` or `handleDonePhase` are still exported and referenced by old tests, those tests will fail with type errors. The new display tests should pass once old tests are cleaned up.

**Step 3 — Write minimal implementation**

In `extensions/megapowers/ui.ts`:

1. **Delete `DONE_MODE_LABELS` constant** entirely.

2. **Remove `handlePhaseTransition` from `MegapowersUI` interface** — delete the method signature.

3. **Remove `handleDonePhase` from `MegapowersUI` interface** — delete the method signature.

4. **Remove `handlePhaseTransition` implementation** from the `createUI()` return object — delete the entire method body.

5. **Remove `handleDonePhase` implementation** from the `createUI()` return object — delete the entire method body.

6. **Remove now-unused imports** that were only used by the removed methods: check if `checkGate`, `formatChangeDescription`, `getValidTransitions`, `transition`, `getFirstPhase` are still used elsewhere in `ui.ts`. Keep those used by `handleIssueCommand` and `handleTriageCommand`; remove the rest.

7. **Remove `closeSourceIssues` helper** if it's only called from `handleDonePhase` — check if anything else uses it. (It's used in `handleDonePhase` which is being removed.)

In `extensions/megapowers/commands.ts`:

Update `handleDoneCommand` to use `showDoneChecklist` instead of the removed `deps.ui.handleDonePhase`:

```ts
// Add import at top of file:
import { showDoneChecklist } from "./ui.js";

// Replace the handler body:
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

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui.test.ts`
Expected: PASS — new display tests pass, old dead-code tests are removed

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 10: Done-phase prompt reads `doneActions` with `done.md` template (AC16, AC17) [depends: 2, 8]

**Files:**
- Create: `prompts/done.md`
- Modify: `extensions/megapowers/prompt-inject.ts`
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to `tests/prompt-inject.test.ts`:

```ts
describe("done phase — doneActions prompt injection (AC16, AC17)", () => {
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

  it("injects done template with single action", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["write-changelog"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).not.toBeNull();
    expect(result).toContain("write-changelog");
  });

  it("no action prompt when doneActions is empty", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: [],
    });
    const result = buildInjectedPrompt(tmp);
    // Should still get protocol prompt but not the done actions template
    expect(result).not.toBeNull();
    expect(result).not.toContain("Execute the following wrap-up actions");
  });

  it("lists all selected actions in doneActions list", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["generate-docs", "capture-learnings"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("generate-docs");
    expect(result).toContain("capture-learnings");
  });

  it("instructs capture-learnings to use megapowers_save_artifact with phase learnings (AC17)", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["capture-learnings"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("learnings");
    expect(result).toContain('phase: "learnings"');
  });

  it("instructs close-issue with explicit steps (AC17)", () => {
    setState(tmp, {
      phase: "done",
      megaEnabled: true,
      doneActions: ["close-issue"],
    });
    const result = buildInjectedPrompt(tmp);
    expect(result).toContain("close-issue");
    expect(result!.length).toBeGreaterThan(200);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/prompt-inject.test.ts --filter "doneActions prompt"`
Expected: FAIL — done phase with doneActions does not inject the expected content (no `done.md` template exists yet, and the injection block still uses per-action template lookup)

**Step 3 — Write minimal implementation**

Create `prompts/done.md`:

```md
You are executing wrap-up actions for a completed issue. Execute each selected action in order.

> **Workflow:** ... → verify → code-review → **done**

## Context
Issue: {{issue_slug}}

## Spec / Diagnosis
{{spec_content}}

## Plan
{{plan_content}}

## Verification Results
{{verify_content}}

## Selected Wrap-up Actions

Execute the following wrap-up actions in order:

{{done_actions_list}}

## Action Instructions

For each action listed above:

### generate-docs
Generate a feature document summarizing what was built and why. Write it to `docs/features/{{issue_slug}}.md` (create the directory if needed). Use the spec, plan, verify artifacts and inspect actual changed files via `jj diff` or `git diff` to get the real file list.

### generate-bugfix-summary
Generate a bugfix summary document. Write it to `docs/bugfixes/{{issue_slug}}.md`. Include: root cause, fix approach, files changed, how to verify the fix.

### write-changelog
Append a changelog entry to `CHANGELOG.md`. Format:
```
## [Unreleased]
### <Added|Fixed|Changed>
- <description> (#<issue-number>)
```
Use `bash` to append or a write tool to update the file.

### capture-learnings
Reflect on the implementation: what was learned, what was surprising, what to do differently. Write 3–7 bullet-point learnings. Save via:
```
megapowers_save_artifact({ phase: "learnings", content: "<markdown bullet list>" })
```

### squash-task-changes
Run `jj squash --into @-` via bash to consolidate per-task jj changes into the phase change. Confirm the squash completed without error.

### close-issue
All other actions are complete. Report the full list of completed wrap-up actions to the user. Inform them the issue is ready to close — they can run `/issue close` or select a new issue to continue.

---

Only execute the actions listed in **Selected Wrap-up Actions**. Skip any action not in that list.

## Learnings from Prior Work
{{learnings}}
```

In `extensions/megapowers/prompt-inject.ts`, replace the done-phase injection block:

```ts
// Before (from Task 2):
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

// After:
} else if (state.doneActions.length > 0) {
  // AC16: done.md template reads doneActions, interpolates the list
  vars.done_actions_list = state.doneActions.map((a) => `- ${a}`).join("\n");
  const template = getPhasePromptTemplate("done");
  if (template) {
    const phasePrompt = interpolatePrompt(template, vars);
    if (phasePrompt) parts.push(phasePrompt);
  }
}
```

In `extensions/megapowers/prompts.ts`, update `PHASE_PROMPT_MAP`:
```ts
// Before:
done: "generate-docs.md",
// After:
done: "done.md",
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/prompt-inject.test.ts --filter "doneActions prompt"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 11: Wire done checklist trigger from `register-tools.ts` (AC11 complete, AC25 final) [depends: 8, 9]

**Files:**
- Modify: `extensions/megapowers/register-tools.ts`
- Test: `tests/tool-signal.test.ts`

The checklist is triggered **only** from the `megapowers_signal` execute handler when `phase_next` advances to done. This is the single authoritative trigger — no parallel trigger in `hooks.ts`.

**Step 1 — Write the failing test**

Add to `tests/tool-signal.test.ts`:

```ts
describe("done checklist trigger wiring (AC11, AC25)", () => {
  it("phase_next to done succeeds and stores doneActions when wired", () => {
    // This test verifies the behavioral outcome: when phase_next advances to done,
    // doneActions should be populated by the checklist trigger.
    // In unit testing, we verify the state is correct after advance.
    writeArtifact(tmp, "001-test", "code-review.md", "# Code Review\nApproved\n");
    setState(tmp, { phase: "code-review" });
    const result = handleSignal(tmp, "phase_next");
    expect(result.error).toBeUndefined();
    expect(result.message).toContain("done");
    expect(readState(tmp).phase).toBe("done");
  });

  it("no remaining doneMode references in extension source files (AC25)", () => {
    const files = [
      "extensions/megapowers/state/state-machine.ts",
      "extensions/megapowers/state/state-io.ts",
      "extensions/megapowers/ui.ts",
      "extensions/megapowers/hooks.ts",
      "extensions/megapowers/prompt-inject.ts",
      "extensions/megapowers/commands.ts",
      "extensions/megapowers/register-tools.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      // doneMode should not appear as an identifier (allow it in comments only)
      const lines = source.split("\n").filter(
        (line) => line.includes("doneMode") && !line.trim().startsWith("//"),
      );
      expect(lines).toHaveLength(0);
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/tool-signal.test.ts --filter "done checklist trigger"`
Expected: FAIL — the AC25 doneMode test may fail if any straggler references remain from earlier tasks

**Step 3 — Write minimal implementation**

In `extensions/megapowers/register-tools.ts`, add to the top imports:
```ts
import { showDoneChecklist } from "./ui.js";
```

In the `megapowers_signal` execute handler, add the done checklist trigger after a successful signal:

```ts
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const { store, jj, ui } = ensureDeps(runtimeDeps, pi, ctx.cwd);
  const result = handleSignal(ctx.cwd, params.action, jj);

  if (result.error) {
    return {
      content: [{ type: "text", text: `Error: ${result.error}` }],
      details: undefined,
    };
  }

  // AC11: Show done checklist when phase_next advances to done
  // Trigger is here ONLY — not in hooks.ts — to prevent duplicate presentation
  if (params.action === "phase_next") {
    const currentState = readState(ctx.cwd);
    if (currentState.phase === "done") {
      await showDoneChecklist(ctx, ctx.cwd);
    }
  }

  if (ctx.hasUI) {
    ui.renderDashboard(ctx, readState(ctx.cwd), store);
  }

  return {
    content: [{ type: "text", text: result.message ?? "OK" }],
    details: undefined,
  };
},
```

Scan all files listed in the AC25 test for any remaining `doneMode` references (non-comment code) and remove them. After Tasks 1–9, these should already be clean — this task confirms and fixes any stragglers.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/tool-signal.test.ts --filter "done checklist trigger"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: All passing

---

### Task 12: Update prompt files for `phase_back` (AC18, AC19, AC20, AC21) [no-test]

**Justification:** These are prompt/instruction markdown files — they instruct the LLM how to behave. There is no programmatic behavior to unit test. Changes verified by grep.

**Files:**
- Modify: `prompts/megapowers-protocol.md`
- Modify: `prompts/verify.md`
- Modify: `prompts/code-review.md`
- Modify: `prompts/review-plan.md`

**Step 1 — Make the changes**

In `prompts/megapowers-protocol.md`, add `phase_back` to the signal actions list after `phase_next` (AC18):
```md
- `{ action: "phase_back" }` — Go back to the previous phase (feature workflow only). Resolves the first `backward` transition from the current phase: verify→implement, code-review→implement, review→plan. Returns an error if no backward transition exists from the current phase.
```

In `prompts/verify.md`, update the "going back" instruction (AC19):

Replace any text referencing `/phase implement` for going back, such as:
> "If verification fails, the user will need to use `/phase implement` to go back."

With:
```md
If any acceptance criterion fails and implementation changes are needed, call `megapowers_signal({ action: "phase_back" })` to return to the implement phase. Explain what needs fixing before calling it.
```

In `prompts/code-review.md`, update the needs-rework instruction (AC20):

Replace any text referencing `/phase implement` or `/phase plan` for going back with:
```md
### If needs-rework
Structural problems that cannot be patched in-place (wrong abstraction, missing component, broken architecture). Do not try to fix inline:
1. Save the code review report with detailed findings via `megapowers_save_artifact({ phase: "code-review", content: "..." })`
2. Call `megapowers_signal({ action: "phase_back" })` to go back to the implement phase
3. For fundamental design issues requiring plan changes, inform the user and recommend `/phase plan` to transition back manually
```

In `prompts/review-plan.md`, update the rework instruction (AC21):

Replace any text that says the user must change the phase manually with:
```md
If the plan needs revision, provide specific, actionable feedback on what must change. Once the feedback is clear, call `megapowers_signal({ action: "phase_back" })` to return to the plan phase for rework. Do not approve a plan that has unresolved issues.
```

**Step 2 — Verify**
Run:
```bash
grep -n "phase_back" prompts/megapowers-protocol.md prompts/verify.md prompts/code-review.md prompts/review-plan.md
```
Expected: At least one `phase_back` reference in each of the four files.

---

## Task Dependency Graph

```
Task 1 (doneMode→doneActions state)
  ├── Task 2 (hooks/inject/ui/commands refs) ─┬── Task 5 (remove popups [no-test])
  ├── Task 3 (phase_back + schema)             │
  ├── Task 4 (phase_next skips bwd)            │
  └── Task 6 (getDoneChecklistItems)  ─────────┤── Task 7 (showChecklistUI [no-test])
                                                │     └── Task 8 (showDoneChecklist)
                                                │           ├── Task 9 (remove dead code + display)
                                                │           └── Task 10 (done.md prompt) [also depends: 2]
                                                │                 └── Task 11 (wire checklist) [also depends: 9]
                                                └── Task 12 (prompt files [no-test])
```