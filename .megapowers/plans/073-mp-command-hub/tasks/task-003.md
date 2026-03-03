---
id: 3
title: Implement /mp on and /mp off by delegating to existing mega toggle logic
status: approved
depends_on:
  - 1
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/mp/mp-handlers.ts
files_to_create: []
---

### Task 3: Implement /mp on and /mp off by delegating to existing mega toggle logic

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-on-off.test.ts`

**Step 1 — Write the failing test**
```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createMpRegistry } from "../extensions/megapowers/mp/mp-handlers.js";
import { writeState, readState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";

function makeMockPi() {
  let active = ["megapowers_signal", "subagent", "pipeline", "other"];
  return {
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names;
    },
    sendUserMessage: (_c: any, _o?: any) => {},
  } as any;
}

describe("/mp on|off", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mp-on-off-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("/mp off disables mega enforcement and hides custom tools (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: true });

    const pi = makeMockPi();
    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.off.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(false);
    expect(pi.getActiveTools()).not.toContain("megapowers_signal");
    expect(pi.getActiveTools()).not.toContain("subagent");
    expect(pi.getActiveTools()).not.toContain("pipeline");
  });

  it("/mp on enables mega enforcement and restores custom tools (AC17)", async () => {
    writeState(tmp, { ...createInitialState(), megaEnabled: false });

    const pi = makeMockPi();
    // simulate that tools were hidden
    pi.setActiveTools(["other"]);

    const deps = { pi, store: {} as any, ui: {} as any } as any;
    const ctx = { cwd: tmp, hasUI: false, isIdle: () => true, ui: { notify: () => {} } } as any;

    const registry = createMpRegistry(deps);
    await registry.on.execute("", ctx);

    const state = readState(tmp);
    expect(state.megaEnabled).toBe(true);
    expect(pi.getActiveTools()).toContain("megapowers_signal");
    expect(pi.getActiveTools()).toContain("subagent");
    expect(pi.getActiveTools()).toContain("pipeline");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-on-off.test.ts`
Expected: FAIL — `expect(state.megaEnabled).toBe(false)` fails with `expected true to be false` (because the placeholder handlers from Task 1 return "Coming soon." and do not toggle state)

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/mp/mp-handlers.ts`:

1) Add the new import at the top of the file (alongside the existing `import type { Deps }`):

```ts
import { handleMegaCommand } from "../commands.js";
```

2) Inside `createMpRegistry()`, replace the placeholder `on` handler (which currently returns `"Coming soon."`) with:

```ts
  registry.on = {
    tier: "programmatic",
    description: "Enable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("on", ctx as any, deps);
    },
  };
```

3) Replace the placeholder `off` handler (which currently returns `"Coming soon."`) with:

```ts
  registry.off = {
    tier: "programmatic",
    description: "Disable megapowers enforcement",
    execute: async (_args: string, ctx: ExtensionCommandContext) => {
      await handleMegaCommand("off", ctx as any, deps);
    },
  };
```

All other handlers (`help`, `new`, stubs) remain unchanged from Task 1.

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-on-off.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
