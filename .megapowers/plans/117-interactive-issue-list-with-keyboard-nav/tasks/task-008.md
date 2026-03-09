---
id: 8
title: Route Archive through the existing archive behavior
status: approved
depends_on:
  - 7
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-archive-action.test.ts
---

### Task 8: Route Archive through the existing archive behavior [depends: 7]

Covers AC: 18, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-archive-action.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-archive-action.test.ts` with:

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
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-archive-action-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("Archive action", () => {
  it("archives the selected issue via the existing store archive path", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const target = store.createIssue("Archive me", "feature", "desc", undefined, "M1", 1);
    const state = createInitialState();

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "archive", issue: target }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    await ui.handleIssueCommand(ctx as any, state, store, "list");

    expect(store.getIssue(target.slug)).toBeNull();
    expect(store.listArchivedIssues().some((issue) => issue.slug === target.slug)).toBe(true);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-archive-action.test.ts`
Expected: FAIL — `Expected: true Received: false`

**Step 3 — Write minimal implementation**
Extend the `/issue list` result handling in `extensions/megapowers/ui.ts` with the same archive logic currently used by `/issue archive <slug>`, inserted alongside the existing `create` and `open` branches (do not remove earlier handlers):

```ts
        if (result.type === "issue-action" && result.action === "archive") {
          const archiveResult = store.archiveIssue(result.issue.slug);
          if (!archiveResult.ok) {
            ctx.ui.notify(archiveResult.error, "error");
            return state;
          }

          ctx.ui.notify(`Archived: ${result.issue.slug}`, "info");
          if (state.activeIssue === result.issue.slug) {
            const resetState: MegapowersState = {
              ...createInitialState(),
              megaEnabled: state.megaEnabled,
              branchName: state.branchName,
              baseBranch: state.baseBranch,
            };
            writeState(ctx.cwd, resetState);
            this.renderDashboard(ctx, resetState, store);
            return resetState;
          }

          this.renderDashboard(ctx, state, store);
          return state;
        }
```

This task should deliberately reuse the same reset behavior already present in the `archive` subcommand branch.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-archive-action.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
