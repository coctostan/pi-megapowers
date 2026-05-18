---
id: 2
title: Update hook status indicator
status: approved
depends_on:
  - 1
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
  - tests/hooks.test.ts
files_to_create: []
---

**Covers:** AC 1, AC 2, AC 3, AC 4, AC 5, AC 6, AC 23

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks.test.ts`

**Step 1 — Write the failing test**
Append to `tests/hooks.test.ts`:

```ts
import { onBeforeAgentStart } from "../extensions/megapowers/hooks.js";
import { createStore } from "../extensions/megapowers/state/store.js";

describe("onBeforeAgentStart — compact context status", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-context-status-"));
    mkdirSync(join(tmp, ".megapowers", "plans", "001-test"), { recursive: true });
    writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "spec.md"), "# Spec");
    writeFileSync(join(tmp, ".megapowers", "plans", "001-test", "plan.md"), "# Plan\n\n### Task 1: Build it\n");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("keeps hidden megapowers-context injection and updates TUI status without notifications", async () => {
    setState(tmp, { phase: "implement", currentTaskIndex: 0, completedTasks: [], tddTaskState: { taskIndex: 1, state: "test-written", skipped: false } });
    const notifications: string[] = [];
    const statuses: string[] = [];
    const ctx = {
      cwd: tmp,
      hasUI: true,
      ui: {
        notify: (message: string) => notifications.push(message),
        setStatus: (message: string) => statuses.push(message),
      },
    };

    const result = await onBeforeAgentStart({}, ctx as any, { store: createStore(tmp), ui: { renderDashboard: () => {} } } as any);

    expect(result?.message?.customType).toBe("megapowers-context");
    expect(result?.message?.display).toBe(false);
    expect(result?.message?.content).toContain("megapowers_signal");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toContain("feature/implement");
    expect(statuses[0]).toContain("task 1/1");
    expect(statuses[0]).toContain("artifacts");
    expect(notifications).toEqual([]);
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks.test.ts`
Expected: FAIL — `Expected length: 1` for `expect(statuses).toHaveLength(1)`

**Step 3 — Write minimal implementation**
Modify `extensions/megapowers/hooks.ts` imports:

```ts
import { buildContextSummary, formatCompactContextStatus } from "./context-summary.js";
```

Replace `onBeforeAgentStart` with:

```ts
export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;
  await preparePlanReviewContext(ctx.cwd);
  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;

  if (ctx.hasUI && ctx.ui?.setStatus) {
    const summary = buildContextSummary(ctx.cwd, store);
    ctx.ui.setStatus(formatCompactContextStatus(summary));
  }

  return {
    message: {
      customType: "megapowers-context",
      content: prompt,
      display: false,
    },
  };
}
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/hooks.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
