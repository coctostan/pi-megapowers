---
id: 10
title: Add branchName and baseBranch to MegapowersState
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/state/state-machine.ts
  - extensions/megapowers/state/state-io.ts
  - tests/state-io.test.ts
files_to_create: []
---

### Task 10: Add branchName to MegapowersState (AC13) and persist baseBranch to support done-phase squash (supports AC18)

**Justification for baseBranch (intentional extension beyond AC13 text, needed to fulfill AC18 behavior):**
AC13 specifies adding `branchName`. `baseBranch` is added as a co-field because AC18 requires calling
`squashAndPush(execGit, branchName, baseBranch, commitMessage)` in the done phase — and the spec's Out of
Scope section confirms the base branch is always the branch that was current at issue activation time.
There is no way to recover this value later (git history would be ambiguous), so it must be persisted
alongside `branchName` when the issue is first activated (Task 12). Both fields default to `null` and
both are included in `KNOWN_KEYS` to survive state round-trips.

**Files:**
- Modify: `extensions/megapowers/state/state-machine.ts`
- Modify: `extensions/megapowers/state/state-io.ts`
- Modify: `tests/state-io.test.ts`

**Step 1 — Write the failing test**

Add to `tests/state-io.test.ts` inside the existing `describe("state-io")` block:

```typescript
it("persists and reads branchName field (AC13)", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    branchName: "feat/001-test",
  };
  writeState(tmp, state);
  const read = readState(tmp);
  expect(read.branchName).toBe("feat/001-test");
});

it("persists and reads baseBranch field (required to support AC18 squashAndPush)", () => {
  const state = {
    ...createInitialState(),
    activeIssue: "001-test",
    branchName: "feat/001-test",
    baseBranch: "main",
  };
  writeState(tmp, state);
  const read = readState(tmp);
  expect(read.baseBranch).toBe("main");
});

it("defaults branchName and baseBranch to null when not in state.json", () => {
  const state = readState(tmp);
  expect(state.branchName).toBeNull();
  expect(state.baseBranch).toBeNull();
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/state-io.test.ts`
Expected: FAIL — Property 'branchName' does not exist on type 'MegapowersState'

**Step 3 — Write minimal implementation**

In `extensions/megapowers/state/state-machine.ts`, add to the `MegapowersState` interface:

```typescript
  branchName: string | null;
  baseBranch: string | null;
```

And in `createInitialState()`, add:

```typescript
    branchName: null,
    baseBranch: null,
```

In `extensions/megapowers/state/state-io.ts`, update `KNOWN_KEYS`:

```typescript
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "version", "activeIssue", "workflow", "phase", "phaseHistory",
  "reviewApproved", "planMode", "planIteration", "currentTaskIndex", "completedTasks",
  "tddTaskState", "doneActions", "megaEnabled", "branchName", "baseBranch",
]);
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/state-io.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
