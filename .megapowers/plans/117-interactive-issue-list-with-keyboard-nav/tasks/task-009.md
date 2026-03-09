---
id: 9
title: Route close actions through existing state and phase behavior
status: approved
depends_on:
  - 8
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-close-actions.test.ts
---

### Task 9: Route close actions through existing state and phase behavior [depends: 8]

Covers AC: 22, 23, 24, 25
**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-close-actions.test.ts`
**Step 1 — Write the failing test**
Create `tests/ui-issue-command-close-actions.test.ts` with:
```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { readState, writeState } from "../extensions/megapowers/state/state-io.js";
import { createStore } from "../extensions/megapowers/state/store.js";
import { createUI } from "../extensions/megapowers/ui.js";
let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-close-actions-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});
describe("close actions", () => {
  it("closes a non-active issue and keeps the active issue unchanged", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const nonActive = store.createIssue("Non active close", "feature", "desc", undefined, "M1", 1);
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 2);
    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close", issue: nonActive }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterClose = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(nonActive.slug)?.status).toBe("done");
    expect(afterClose.activeIssue).toBe(active.slug);
  });
  it("closes the active issue immediately for close-now", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "verify" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "close-now", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterCloseNow = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(store.getIssue(active.slug)?.status).toBe("done");
    expect(afterCloseNow.activeIssue).toBeNull();
  });
  it("sends the active issue to done phase for go-to-done", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const active = store.createIssue("Active close", "feature", "desc", undefined, "M1", 1);

    const state = {
      ...createInitialState(),
      activeIssue: active.slug,
      workflow: "feature" as const,
      phase: "code-review" as const,
      megaEnabled: true,
    };
    writeState(tmp, state);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "issue-action", action: "go-to-done", issue: active }),
        select: async () => null,
        input: async () => null,
        editor: async () => null,
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };
    const afterDone = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(afterDone.phase).toBe("done");
    expect(readState(tmp).phase).toBe("done");
  });
});
```
**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-close-actions.test.ts`
Expected: FAIL — `Expected: "done" Received: "open"`
**Step 3 — Write minimal implementation**
At the top of `extensions/megapowers/ui.ts`, add:
```ts
import { handleSignal } from "./tools/tool-signal.js";
```

Then extend the `/issue list` result handling in `extensions/megapowers/ui.ts` by appending these branches **after** the existing `create`, `open`, and `archive` handlers from Tasks 6-8 (do not replace earlier handlers):

```ts
        if (result.type === "issue-action" && result.action === "close") {
          store.updateIssueStatus(result.issue.slug, "done");
          ctx.ui.notify(`Closed: ${result.issue.slug}`, "info");
          this.renderDashboard(ctx, state, store);
          return state;
        }
        if (result.type === "issue-action" && result.action === "close-now") {
          store.updateIssueStatus(result.issue.slug, "done");
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
        if (result.type === "issue-action" && result.action === "go-to-done") {
          writeState(ctx.cwd, state);
          const signal = handleSignal(ctx.cwd, "phase_next", "done");
          if (signal.error) {
            ctx.ui.notify(signal.error, "error");
            return state;
          }
          const nextState = readState(ctx.cwd);
          this.renderDashboard(ctx, nextState, store);
          return nextState;
        }
```
**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-close-actions.test.ts`
Expected: PASS
**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
