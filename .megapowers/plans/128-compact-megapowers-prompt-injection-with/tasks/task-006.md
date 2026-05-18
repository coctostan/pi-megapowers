---
id: 6
title: Add `/mp context` command
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/mp/mp-handlers.ts
  - tests/mp-command.test.ts
files_to_create: []
---

**Covers:** AC 8, AC 9, AC 10, AC 15, AC 17, AC 21

**Files:**
- Modify: `extensions/megapowers/mp/mp-handlers.ts`
- Test: `tests/mp-command.test.ts`

**Step 1 — Write the failing test**
Append these imports to `tests/mp-command.test.ts` if they are not already present:

```ts
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState } from "../extensions/megapowers/state/state-machine.js";
import { createStore } from "../extensions/megapowers/state/store.js";
```

Append this test to `tests/mp-command.test.ts`:

```ts
describe("/mp context", () => {
  it("renders the same default and debug context report through the /mp registry", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mp-context-"));
    try {
      mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
      writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "# Spec");
      writeState(tmp, { ...createInitialState(), activeIssue: "001-test", workflow: "feature", phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
      const before = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const deps = { ...makeDeps(), store: createStore(tmp) } as any;
      const ctx = { ...makeCtx(), cwd: tmp } as any;
      const registry = createMpRegistry(deps);

      const normal = await dispatchMpCommand("context", ctx, registry);
      const debug = await dispatchMpCommand("context debug", ctx, registry);
      const after = readFileSync(join(tmp, ".megapowers", "state.json"), "utf-8");
      const completions = mpArgumentCompletions("con") ?? [];

      expect(after).toBe(before);
      expect(normal).toContain("Workflow: feature");
      expect(normal).toContain("Phase: plan");
      expect(normal).toContain("Plan mode: draft");
      expect(normal).not.toContain("## Rendered prompt");
      expect(debug).toContain("## Rendered prompt");
      expect(debug).toContain("You are writing a step-by-step implementation plan");
      expect(completions.map((item) => item.value)).toContain("context");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/mp-command.test.ts`
Expected: FAIL — `Expected substring: "Workflow: feature"`

**Step 3 — Write minimal implementation**
Modify imports in `extensions/megapowers/mp/mp-handlers.ts`:

```ts
import { renderContextReport } from "../context-summary.js";
```

Add `"context",` to `MP_SUBCOMMANDS` between `"off"` and `"council"`.

Add this registry entry after `registry.off`:

```ts
registry.context = {
  tier: "programmatic",
  description: "Inspect current derived Megapowers context",
  execute: async (args: string, ctx: ExtensionCommandContext) => {
    return renderContextReport(ctx.cwd, deps.store, { debug: args.trim().toLowerCase() === "debug" });
  },
};
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/mp-command.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
