---
id: 6
title: Invoke focused review fan-out before building the review prompt
status: approved
depends_on:
  - 4
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/hooks.ts
files_to_create:
  - tests/hooks-focused-review.test.ts
---

### Task 6: Invoke focused review fan-out before building the review prompt [depends: 4, 5]

**Files:**
- Modify: `extensions/megapowers/hooks.ts`
- Test: `tests/hooks-focused-review.test.ts`

**Covers:** AC18, AC19

**Step 1 — Write the failing test**
Create `tests/hooks-focused-review.test.ts` with this complete content:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { preparePlanReviewContext } from "../extensions/megapowers/hooks.js";
import { writeState } from "../extensions/megapowers/state/state-io.js";
import { createInitialState, type MegapowersState } from "../extensions/megapowers/state/state-machine.js";

function setState(tmp: string, overrides: Partial<MegapowersState>) {
  writeState(tmp, {
    ...createInitialState(),
    activeIssue: "001-test",
    workflow: "feature",
    ...overrides,
  });
}

function createTaskFiles(tmp: string, count: number) {
  const dir = join(tmp, ".megapowers", "plans", "001-test", "tasks");
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    writeFileSync(
      join(dir, `task-${String(i).padStart(3, "0")}.md`),
      `---\nid: ${i}\ntitle: Task ${i}\nstatus: draft\nfiles_to_modify:\n  - tests/fake-${i}.ts\nfiles_to_create: []\n---\nTask body ${i}.`,
    );
  }
}

describe("preparePlanReviewContext", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hooks-focused-review-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does not invoke focused review fan-out when the current plan has fewer than five tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 4);

    let called = 0;
    await preparePlanReviewContext(tmp, async () => {
      called += 1;
      return {
        ran: false,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: [],
        message: "not triggered",
      };
    });

    expect(called).toBe(0);
  });

  it("invokes focused review fan-out for plan review sessions with five or more tasks", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 5);

    let captured: any = null;
    await preparePlanReviewContext(tmp, async (params) => {
      captured = params;
      return {
        ran: true,
        runtime: "pi-subagents",
        mode: "parallel",
        availableArtifacts: [],
        unavailableArtifacts: ["coverage-review.md"],
        message: "Unavailable focused review artifacts: coverage-review.md",
      };
    });

    expect(captured).toEqual({
      cwd: tmp,
      issueSlug: "001-test",
      workflow: "feature",
      taskCount: 5,
    });
  });

  it("soft-fails when focused review fan-out throws so review can still proceed", async () => {
    setState(tmp, { phase: "plan", planMode: "review" });
    createTaskFiles(tmp, 6);

    await expect(
      preparePlanReviewContext(tmp, async () => {
        throw new Error("subagent timeout");
      }),
    ).resolves.toBeUndefined();
  });
});
```

**Step 2 — Run test, verify it fails**
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: FAIL — `preparePlanReviewContext is not exported by '../extensions/megapowers/hooks.js'`

**Step 3 — Write minimal implementation**
Update `extensions/megapowers/hooks.ts` exactly as follows:

1. Replace the import block at the top with:
```ts
import type { Deps } from "./commands.js";
import { readState, writeState } from "./state/state-io.js";
import { deriveTasks } from "./state/derived.js";
import { buildInjectedPrompt } from "./prompt-inject.js";
import { showDoneChecklist } from "./ui.js";
import { evaluateWriteOverride, recordTestFileWritten } from "./tools/tool-overrides.js";
import { runFocusedReviewFanout, type FocusedReviewFanoutResult } from "./plan-review/focused-review-runner.js";
import { shouldRunFocusedReviewFanout } from "./plan-review/focused-review.js";
```

2. Insert this exported helper above `onBeforeAgentStart`:
```ts
export async function preparePlanReviewContext(
  cwd: string,
  runFocusedReviewFanoutFn: typeof runFocusedReviewFanout = runFocusedReviewFanout,
): Promise<FocusedReviewFanoutResult | void> {
  const state = readState(cwd);
  if (state.phase !== "plan" || state.planMode !== "review" || !state.activeIssue || !state.workflow) {
    return;
  }

  const taskCount = deriveTasks(cwd, state.activeIssue).length;
  if (!shouldRunFocusedReviewFanout(taskCount)) return;

  try {
    return await runFocusedReviewFanoutFn({
      cwd,
      issueSlug: state.activeIssue,
      workflow: state.workflow,
      taskCount,
    });
  } catch {
    return;
  }
}
```

3. Replace `onBeforeAgentStart` with:
```ts
export async function onBeforeAgentStart(_event: any, ctx: any, deps: Deps): Promise<any> {
  const { store } = deps;

  await preparePlanReviewContext(ctx.cwd);

  const prompt = buildInjectedPrompt(ctx.cwd, store);
  if (!prompt) return;

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
Run: `bun test tests/hooks-focused-review.test.ts`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
