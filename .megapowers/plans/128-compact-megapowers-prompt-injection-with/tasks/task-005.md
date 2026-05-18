---
id: 5
title: Add `/mega context` command
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
files_to_create:
  - tests/commands-context.test.ts
---

**Covers:** AC 7, AC 9, AC 10, AC 14, AC 17

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Create: `tests/commands-context.test.ts`

**Step 1 — Write the failing test**
Create `tests/commands-context.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleMegaCommand } from "../extensions/megapowers/commands.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";

function setState(cwd: string, overrides: Partial<MegapowersState>) {
  writeState(cwd, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", megaEnabled: true, ...overrides });
}

function makeDeps(cwd: string) {
  return {
    pi: { getActiveTools: () => [], setActiveTools: (_tools: string[]) => {} },
    store: createStore(cwd),
    ui: { renderDashboard: () => {} },
  } as any;
}

describe("/mega context", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mega-context-command-"));
    const planDir = join(tmp, ".megapowers", "plans", "001-test");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "spec.md"), "# Spec");
    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1 });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("renders default and debug context reports without mutating state", async () => {
    const notices: string[] = [];
    const ctx = { cwd: tmp, hasUI: true, ui: { notify: (message: string) => notices.push(message) } };
    const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");

    await handleMegaCommand("context", ctx as any, makeDeps(tmp));
    await handleMegaCommand("context debug", ctx as any, makeDeps(tmp));

    const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain("Workflow: feature");
    expect(notices[0]).toContain("Phase: plan");
    expect(notices[0]).toContain("Plan mode: draft");
    expect(notices[0]).not.toContain("## Rendered prompt");
    expect(notices[1]).toContain("## Rendered prompt");
    expect(notices[1]).toContain("You are writing a step-by-step implementation plan");
    expect(after).toBe(before);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/commands-context.test.ts`
Expected: FAIL — `Expected length: 2` for `expect(notices).toHaveLength(2)`

**Step 3 — Write minimal implementation**
Modify imports in `extensions/megapowers/commands.ts`:

```ts
import { renderContextReport } from "./context-summary.js";
```

Add this branch after `const sub = args.trim().toLowerCase();` and before the `off` branch:

```ts
if (sub === "context" || sub === "context debug") {
  const report = renderContextReport(ctx.cwd, deps.store, { debug: sub === "context debug" });
  if (ctx.hasUI) ctx.ui.notify(report, "info");
  return;
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/commands-context.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
