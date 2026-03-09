---
id: 7
title: Route Open/Activate through the existing activation path
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-open-action.test.ts
---

### Task 7: Route Open/Activate through the existing activation path [depends: 6]

Covers AC: 17, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-open-action.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-open-action.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-open-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Open/Activate action", () => {
  it("activates the selected issue with the same state reset used by the old `/issue list` flow", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Target issue", "bugfix", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: "999-old-issue",
      workflow: "feature" as const,
      phase: "plan" as const,
      completedTasks: [1, 2],
      currentTaskIndex: 2,
      tddTaskState: { taskIndex: 2, state: "impl-allowed" as const, skipped: false },
    };

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "open", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe(target.slug);
    expect(nextState.workflow).toBe("bugfix");
    expect(nextState.phase).toBe("reproduce");
    expect(nextState.completedTasks).toEqual([]);
    expect(nextState.currentTaskIndex).toBe(0);
    expect(nextState.tddTaskState).toBeNull();
    expect(store.getIssue(target.slug)?.status).toBe("in-progress");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-open-action.test.ts`
Expected: FAIL — `Expected: "001-target-issue" Received: "999-old-issue"`

**Step 3 — Write minimal implementation**
Extend the `/issue list` result handling in `extensions/megapowers/ui.ts` by adding this branch **after** the existing `create` branch from Task 6 (do not replace the whole result block):

```ts
        if (result.type === "issue-action" && result.action === "open") {
          const selected = result.issue;
          const firstPhase = getFirstPhase(selected.type);
          const newState: MegapowersState = {
            ...state,
            activeIssue: selected.slug,
            workflow: selected.type,
            phase: firstPhase,
            phaseHistory: [],
            reviewApproved: false,
            currentTaskIndex: 0,
            completedTasks: [],
            tddTaskState: null,
            doneActions: [],
          };
          writeState(ctx.cwd, newState);
          store.updateIssueStatus(selected.slug, "in-progress");
          ctx.ui.notify(`Activated: ${selected.slug}`, "info");
          this.renderDashboard(ctx, newState, store);
          return newState;
        }
```

Keep the existing outer `commands.ts` activation/VCS behavior unchanged; this task only restores the UI-side state mutation path.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-open-action.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
