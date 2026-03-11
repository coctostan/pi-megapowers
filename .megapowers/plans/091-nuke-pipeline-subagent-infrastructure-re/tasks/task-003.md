---
id: 3
title: Remove satellite bootstrap from the extension entrypoint
status: approved
depends_on:
  - 1
  - 2
no_test: false
files_to_modify:
  - extensions/megapowers/index.ts
  - tests/index-integration.test.ts
  - tests/satellite-root.test.ts
files_to_create: []
---

### Task 3: Remove satellite bootstrap from the extension entrypoint [depends: 1, 2]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Modify: `tests/index-integration.test.ts`
- Test: `tests/satellite-root.test.ts`

**Step 1 — Write the failing test**
Replace the `satellite TDD flow invariants` block in `tests/index-integration.test.ts` with:

```ts
describe("extension bootstrap after legacy pipeline removal", () => {
  it("index.ts does not import or branch on satellite mode", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    expect(source).not.toContain("isSatelliteMode");
    expect(source).not.toContain("setupSatellite");
    expect(source).not.toContain("if (satellite)");
  });
});
```

Replace the body of `tests/satellite-root.test.ts` with:

```ts
import { describe, it, expect } from "bun:test";

describe("legacy satellite bootstrap removal", () => {
  it("index.ts no longer imports the satellite helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const source = readFileSync(join(import.meta.dir, "..", "extensions", "megapowers", "index.ts"), "utf-8");

    expect(source).not.toContain("./satellite.js");
    expect(source).not.toContain("isSatelliteMode");
    expect(source).not.toContain("setupSatellite");
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/index-integration.test.ts tests/satellite-root.test.ts`
Expected: FAIL — assertions fail because `extensions/megapowers/index.ts` still imports `./satellite.js` and still returns early from the satellite branch.

**Step 3 — Write minimal implementation**
In `extensions/megapowers/index.ts`:

1. Remove this import:

```ts
import { isSatelliteMode, setupSatellite } from "./satellite.js";
```

2. Delete the entire satellite bootstrap block at the top of `megapowers()`:

```ts
  const satellite = isSatelliteMode({
    isTTY: process.stdout.isTTY,
    env: process.env as Record<string, string | undefined>,
  });

  if (satellite) {
    setupSatellite(pi);
    return;
  }
```

3. Leave the rest of `megapowers()` intact so the normal hooks, tool registration, and command registration always execute in the primary session.

The top of the file should now begin like this:

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerTools } from "./register-tools.js";
import {
  ensureDeps,
  handleMegaCommand, handleIssueCommand, handleTriageCommand,
  handlePhaseCommand, handleDoneCommand, handleLearnCommand,
  handleTddCommand, handleTaskCommand, handleReviewCommand,
  type RuntimeDeps,
} from "./commands.js";
import { onContext, onSessionStart, onBeforeAgentStart, onToolCall, onToolResult, onAgentEnd } from "./hooks.js";
import { handleMpCommand, mpArgumentCompletions } from "./mp/mp-command.js";

export default function megapowers(pi: ExtensionAPI): void {
  const runtimeDeps: RuntimeDeps = {
    execGit: async (args: string[]) => {
      const r = await pi.exec("git", args);
      if (r.code !== 0) throw new Error(`git ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    },
    execCmd: async (cmd: string, args: string[]) => {
      const r = await pi.exec(cmd, args);
      if (r.code !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${r.code}): ${r.stderr}`);
      return { stdout: r.stdout, stderr: r.stderr };
    },
  };
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/index-integration.test.ts tests/satellite-root.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
