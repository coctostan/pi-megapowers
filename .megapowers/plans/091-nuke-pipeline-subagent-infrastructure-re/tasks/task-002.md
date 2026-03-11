---
id: 2
title: Remove legacy tool names from mega on/off activation lists
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/commands.ts
  - tests/mp-on-off.test.ts
  - tests/commands-tools-filter.test.ts
files_to_create: []
---

### Task 2: Remove legacy tool names from mega on/off activation lists [depends: 1]

**Files:**
- Modify: `extensions/megapowers/commands.ts`
- Modify: `tests/mp-on-off.test.ts`
- Test: `tests/commands-tools-filter.test.ts`

**Step 1 — Write the failing test**
Replace `tests/commands-tools-filter.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";

describe("commands tool filtering", () => {
  it("/mega off/on only toggles megapowers_signal after legacy tool removal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const src = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "commands.ts"), "utf-8");

    expect(src).not.toContain('"pipeline"');
    expect(src).not.toContain('"subagent"');
    expect(src).toContain('t !== "megapowers_signal"');
    expect(src).toContain('const toolsToAdd = ["megapowers_signal"]');
  });
});
```

Update `tests/mp-on-off.test.ts` so its expectations are:

```ts
expect(pi.getActiveTools()).not.toContain("megapowers_signal");
expect(pi.getActiveTools()).not.toContain("pipeline");
expect(pi.getActiveTools()).not.toContain("subagent");
```

for `/mp off`, and:

```ts
expect(pi.getActiveTools()).toContain("megapowers_signal");
expect(pi.getActiveTools()).not.toContain("pipeline");
expect(pi.getActiveTools()).not.toContain("subagent");
```

for `/mp on`.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-on-off.test.ts tests/commands-tools-filter.test.ts`
Expected: FAIL — assertions fail because `extensions/megapowers/commands.ts` still filters and restores `subagent` and `pipeline`.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/commands.ts`, change `handleMegaCommand()` so it only hides/restores `megapowers_signal`:

```ts
  if (sub === "off") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: false });
    const activeTools = deps.pi.getActiveTools().filter(
      (t: string) => t !== "megapowers_signal"
    );
    deps.pi.setActiveTools(activeTools);
    if (ctx.hasUI) ctx.ui.notify("Megapowers OFF — all enforcement disabled.", "info");
    return;
  }

  if (sub === "on") {
    const state = readState(ctx.cwd);
    writeState(ctx.cwd, { ...state, megaEnabled: true });
    const activeTools = deps.pi.getActiveTools();
    const toolsToAdd = ["megapowers_signal"];
    const missing = toolsToAdd.filter((t: string) => !activeTools.includes(t));
    if (missing.length > 0) {
      deps.pi.setActiveTools([...activeTools, ...missing]);
    }
    if (ctx.hasUI) ctx.ui.notify("Megapowers ON — enforcement restored.", "info");
    return;
  }
```

In `tests/mp-on-off.test.ts`, update the mock's starting tool list to keep the legacy names out of the restored expectations:

```ts
function makeMockPi() {
  let active = ["megapowers_signal", "other"];
  return {
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names;
    },
    sendUserMessage: (_c: any, _o?: any) => {},
  } as any;
}
```

Then update the `/mp on` and `/mp off` assertions to match the new expectations from Step 1.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-on-off.test.ts tests/commands-tools-filter.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
