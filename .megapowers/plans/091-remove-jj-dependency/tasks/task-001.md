---
id: 1
title: Remove task-level jj change helpers and task_done jj integration
status: approved
depends_on: []
no_test: false
files_to_modify:
  - extensions/megapowers/task-coordinator.ts
  - extensions/megapowers/tools/tool-signal.ts
  - tests/task-coordinator.test.ts
  - tests/tool-signal.test.ts
files_to_create: []
---

### Task 1: Remove task-level jj change helpers and task_done jj integration
**Covers AC 9, AC 20 (tests updated to remove jj path)**

**Goal:** Remove `createTaskChange` / `inspectTaskChange` exports and remove `task_done`’s optional jj side-effects. This task must **not** require `MegapowersState` jj fields to be removed yet (that happens in Task 11).

#### Step 1 — Write the failing tests (self-contained)

In `tests/task-coordinator.test.ts`:
- Remove `createTaskChange, inspectTaskChange` from named imports.
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Add:

```ts
describe("task-coordinator jj removals", () => {
  it("does not export createTaskChange or inspectTaskChange", () => {
    expect((taskCoordinator as any).createTaskChange).toBeUndefined();
    expect((taskCoordinator as any).inspectTaskChange).toBeUndefined();
  });
});
```

In `tests/tool-signal.test.ts`:
- Remove `import type { JJ } from "../extensions/megapowers/jj.js";` if present.
- Delete any existing suite that asserts jj integration for `task_done`.
- Add:

```ts
describe("task_done without jj bookkeeping", () => {
  it("completes task using only state-machine fields", () => {
    writeArtifact(tmp, "001-test", "plan.md", "# Plan\n\n### Task 1: A\n\n### Task 2: B\n");
    setState(tmp, {
      phase: "implement",
      currentTaskIndex: 0,
      completedTasks: [],
      tddTaskState: { taskIndex: 1, state: "impl-allowed", skipped: false },
    });

    const result = handleSignal(tmp, "task_done");
    expect(result.error).toBeUndefined();

    const state = readState(tmp);
    expect(state.completedTasks).toEqual([1]);
  });
});
```

#### Step 2 — Run tests, verify RED
Run:
- `bun test tests/task-coordinator.test.ts tests/tool-signal.test.ts`

Expected failure (from `tests/task-coordinator.test.ts`): the new assertions fail because `createTaskChange` / `inspectTaskChange` are still exported.

#### Step 3 — Implement (surgical edits)

In `extensions/megapowers/task-coordinator.ts`:
1. Delete the `export function createTaskChange(...)` entirely.
2. Delete the `export async function inspectTaskChange(...)` entirely.
3. Keep unrelated exports intact.

In `extensions/megapowers/tools/tool-signal.ts`:
1. Remove imports of `createTaskChange` / `inspectTaskChange`.
2. Remove `import type { JJ } from "../jj.js";` if present.
3. In `handleTaskDone`, delete the entire optional jj async fire-and-forget block (`if (jj) { ... }`).
   - Also remove any variables that exist **only** to support that block.
   - **Do not** remove references to `state.taskJJChanges` in other unrelated branches in this file (those fields are removed later in Task 11).

#### Step 4 — Run targeted tests, verify GREEN
Run:
- `bun test tests/task-coordinator.test.ts tests/tool-signal.test.ts`

Expected: PASS.

#### Step 5 — Full regression
Run:
- `bun test`

Expected: all tests pass.
