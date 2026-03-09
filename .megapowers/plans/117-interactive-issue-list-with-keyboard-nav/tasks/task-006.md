---
id: 6
title: Route the create row into the existing new-issue flow
status: approved
depends_on:
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/ui.ts
files_to_create:
  - tests/ui-issue-command-create-row.test.ts
---

### Task 6: Route the create row into the existing new-issue flow [depends: 5]

Covers AC: 12, 25

**Files:**
- Modify: `extensions/megapowers/ui.ts`
- Test: `tests/ui-issue-command-create-row.test.ts`

**Step 1 — Write the failing test**
Create `tests/ui-issue-command-create-row.test.ts` with:

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
  tmp = mkdtempSync(join(tmpdir(), "ui-issue-create-row-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("create row action", () => {
  it("enters the existing issue creation flow when the widget returns a create action", async () => {
    const store = createStore(tmp);
    const ui = createUI();
    const state = createInitialState();
    store.createIssue("Existing issue", "feature", "desc", undefined, "M1", 1);

    const ctx = {
      hasUI: true,
      cwd: tmp,
      ui: {
        theme: { fg: (_c: string, t: string) => t, bold: (t: string) => t },
        custom: async () => ({ type: "create" }),
        select: async (prompt: string) => (prompt.includes("Issue type") ? "feature" : null),
        input: async () => "Created from widget",
        editor: async () => "Widget-created description",
        notify: () => {},
        setWidget: () => {},
        setStatus: () => {},
      },
    };

    const nextState = await ui.handleIssueCommand(ctx as any, state, store, "list");
    expect(nextState.activeIssue).toBe("002-created-from-widget");
    expect(nextState.workflow).toBe("feature");
    expect(store.getIssue("002-created-from-widget")?.status).toBe("in-progress");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/ui-issue-command-create-row.test.ts`
Expected: FAIL — `Expected: "002-created-from-widget" Received: null`

**Step 3 — Write minimal implementation**
Update the `/issue list` branch in `extensions/megapowers/ui.ts` so the custom-widget result handles the create row before returning:

```ts
        const result = await showIssueListUI(ctx as any, rows, state.activeIssue);
        if (!result) return state;
        if (result.type === "create") {
          return this.handleIssueCommand(ctx, state, store, "new");
        }

        return state;
```

Keep this `create` branch before the final `return state;` and preserve all existing Task 5 handling unchanged.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/ui-issue-command-create-row.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
