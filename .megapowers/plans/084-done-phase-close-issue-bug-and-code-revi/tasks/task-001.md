---
id: 1
title: Add doneChecklistShown to MegapowersState schema
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/state/state-machine.ts
  - extensions/megapowers/state/state-io.ts
files_to_create: []
---

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
